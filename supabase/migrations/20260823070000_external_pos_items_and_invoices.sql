-- Support ad-hoc POS lines and invoice creation without converting invoices
-- into completed sales or changing inventory.

alter table public.sales
  alter column payment_method drop default;

alter table public.sale_items
  alter column product_id drop not null,
  add column item_source text not null default 'catalogue',
  add constraint sale_items_source_check
    check (item_source in ('catalogue', 'external')),
  add constraint sale_items_source_product_check check (
    (item_source = 'catalogue' and product_id is not null)
    or (item_source = 'external' and product_id is null and variant_id is null)
  );

alter table public.orders
  add column document_type text not null default 'order',
  add constraint orders_document_type_check
    check (document_type in ('order', 'invoice'));

alter table public.order_items
  alter column product_id drop not null,
  add column variant_id uuid,
  add column variant_name text,
  add column item_source text not null default 'catalogue',
  add constraint order_items_variant_fkey
    foreign key (business_id, product_id, variant_id)
    references public.product_variants (business_id, product_id, id)
    on delete restrict,
  add constraint order_items_variant_name_pair check (
    (variant_id is null) = (variant_name is null)
  ),
  add constraint order_items_source_check
    check (item_source in ('catalogue', 'external')),
  add constraint order_items_source_product_check check (
    (item_source = 'catalogue' and product_id is not null)
    or (item_source = 'external' and product_id is null and variant_id is null)
  );

create function public.normalize_pos_items(
  target_business_id uuid,
  items jsonb
)
returns table (
  line_index integer,
  item_source text,
  product_id uuid,
  variant_id uuid,
  product_name text,
  variant_name text,
  sku text,
  quantity numeric,
  unit_price numeric,
  unit_cost numeric,
  line_gross numeric,
  track_inventory boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  item jsonb;
  item_number integer := 0;
  item_product_id uuid;
  item_variant_id uuid;
  item_quantity numeric;
  item_unit_price numeric;
  item_unit_cost numeric;
  item_product_name text;
  item_variant_name text;
  item_sku text;
  item_tracks_inventory boolean;
  product_record record;
  variant_record record;
begin
  if jsonb_typeof(items) <> 'array'
    or jsonb_array_length(items) < 1
    or jsonb_array_length(items) > 100 then
    raise exception using errcode = 'P0001', message = 'Add at least one product to the sale.';
  end if;

  for item in select value from jsonb_array_elements(items)
  loop
    item_number := item_number + 1;
    item_quantity := (item ->> 'quantity')::numeric;
    item_product_id := nullif(item ->> 'product_id', '')::uuid;
    item_variant_id := nullif(item ->> 'variant_id', '')::uuid;

    if item_quantity <= 0 or item_quantity > 10000 then
      raise exception using errcode = 'P0001', message = 'Enter a valid product quantity.';
    end if;

    if item_product_id is null then
      item_product_name := btrim(coalesce(item ->> 'external_name', ''));
      item_sku := nullif(btrim(coalesce(item ->> 'external_sku', '')), '');
      item_unit_price := (item ->> 'unit_price')::numeric;
      item_unit_cost := 0;
      item_variant_name := null;
      item_tracks_inventory := false;

      if item_variant_id is not null
        or char_length(item_product_name) < 1
        or char_length(item_product_name) > 160
        or item_unit_price < 0 then
        raise exception using errcode = 'P0001', message = 'Enter valid external product details.';
      end if;

      return query select
        item_number, 'external'::text, null::uuid, null::uuid,
        item_product_name, null::text, item_sku, item_quantity,
        item_unit_price, item_unit_cost,
        round(item_quantity * item_unit_price, 4), false;
      continue;
    end if;

    select
      product.name,
      product.sku,
      product.selling_price,
      product.cost_price,
      product.track_inventory
    into product_record
    from public.products as product
    where product.business_id = target_business_id
      and product.id = item_product_id
      and product.status = 'active';

    if not found then
      raise exception using errcode = 'P0001', message = 'A selected product is unavailable.';
    end if;

    item_product_name := product_record.name;
    item_sku := product_record.sku;
    item_unit_price := product_record.selling_price;
    item_unit_cost := product_record.cost_price;
    item_variant_name := null;
    item_tracks_inventory := product_record.track_inventory;

    if item_variant_id is not null then
      select variant.name, variant.sku, variant.selling_price, variant.cost_price
      into variant_record
      from public.product_variants as variant
      where variant.business_id = target_business_id
        and variant.product_id = item_product_id
        and variant.id = item_variant_id
        and variant.is_active;

      if not found then
        raise exception using errcode = 'P0001', message = 'A selected product variant is unavailable.';
      end if;

      item_variant_name := variant_record.name;
      item_sku := coalesce(variant_record.sku, item_sku);
      item_unit_price := variant_record.selling_price;
      item_unit_cost := variant_record.cost_price;
    elsif exists (
      select 1 from public.product_variants as variant
      where variant.business_id = target_business_id
        and variant.product_id = item_product_id
        and variant.is_active
    ) then
      raise exception using errcode = 'P0001', message = 'Choose a variant for every applicable product.';
    end if;

    return query select
      item_number, 'catalogue'::text, item_product_id, item_variant_id,
      item_product_name, item_variant_name, item_sku, item_quantity,
      item_unit_price, item_unit_cost,
      round(item_quantity * item_unit_price, 4), item_tracks_inventory;
  end loop;
end;
$$;

revoke all on function public.normalize_pos_items(uuid, jsonb)
  from public, anon, authenticated;

create or replace function public.complete_pos_sale(
  target_business_id uuid,
  selected_customer_id uuid,
  selected_payment_method text,
  sale_discount_amount numeric,
  items jsonb
)
returns table (
  sale_id uuid,
  sale_number text,
  total_amount numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  business_currency text;
  new_sale_id uuid := gen_random_uuid();
  new_sale_number text;
  subtotal numeric;
  final_total numeric;
  default_location_id uuid;
begin
  if current_user_id is null
    or not public.is_business_member(target_business_id) then
    raise exception using errcode = '42501', message = 'You do not have access to this business.';
  end if;

  if selected_payment_method not in ('cash', 'bank_transfer', 'pos', 'card', 'other') then
    raise exception using errcode = 'P0001', message = 'Select a valid payment method.';
  end if;
  if sale_discount_amount is null or sale_discount_amount < 0 then
    raise exception using errcode = 'P0001', message = 'Enter a valid discount.';
  end if;

  select business.currency_code into business_currency
  from public.businesses as business
  where business.id = target_business_id;

  if selected_customer_id is not null and not exists (
    select 1 from public.customers as customer
    where customer.business_id = target_business_id
      and customer.id = selected_customer_id
  ) then
    raise exception using errcode = 'P0001', message = 'The selected customer is unavailable.';
  end if;

  select round(sum(normalized.line_gross), 4)
  into subtotal
  from public.normalize_pos_items(target_business_id, items) as normalized;

  if sale_discount_amount > subtotal then
    raise exception using errcode = 'P0001', message = 'Discount cannot exceed the sale subtotal.';
  end if;

  final_total := round(subtotal - sale_discount_amount, 4);
  new_sale_number := 'POS-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
    || '-' || upper(left(replace(new_sale_id::text, '-', ''), 6));

  insert into public.sales (
    id, business_id, customer_id, sale_number, channel, status,
    payment_method, currency_code, subtotal_amount, discount_amount,
    tax_amount, total_amount, sold_at, created_by
  ) values (
    new_sale_id, target_business_id, selected_customer_id, new_sale_number,
    'pos', 'completed', selected_payment_method, business_currency, subtotal,
    sale_discount_amount, 0, final_total, now(), current_user_id
  );

  with normalized as materialized (
    select * from public.normalize_pos_items(target_business_id, items)
  ), ranked as (
    select normalized.*, max(line_index) over () as final_line
    from normalized
  ), provisional as (
    select ranked.*,
      case
        when line_index = final_line or subtotal = 0 then 0::numeric
        else least(
          sale_discount_amount,
          round(sale_discount_amount * line_gross / subtotal, 4)
        )
      end as provisional_discount
    from ranked
  ), allocated as (
    select provisional.*,
      case
        when line_index = final_line then
          sale_discount_amount - sum(provisional_discount) over ()
        else provisional_discount
      end as line_discount
    from provisional
  )
  insert into public.sale_items (
    business_id, sale_id, item_source, product_id, variant_id,
    product_name, variant_name, sku, quantity, unit_price, unit_cost,
    discount_amount
  )
  select
    target_business_id, new_sale_id, item_source, product_id, variant_id,
    product_name, variant_name, sku, quantity, unit_price, unit_cost,
    line_discount
  from allocated;

  select location.id into default_location_id
  from public.inventory_locations as location
  where location.business_id = target_business_id
    and location.is_default and location.is_active
  order by location.created_at
  limit 1;

  if default_location_id is not null then
    insert into public.inventory_movements (
      business_id, product_id, location_id, movement_type, quantity_delta,
      unit_cost, reference_type, reference_id, note, occurred_at, created_by
    )
    select
      target_business_id, sale_item.product_id, default_location_id, 'sale',
      -sale_item.quantity, sale_item.unit_cost, 'sale', new_sale_id,
      'POS sale ' || new_sale_number, now(), current_user_id
    from public.sale_items as sale_item
    join public.products as product
      on product.business_id = sale_item.business_id
      and product.id = sale_item.product_id
    where sale_item.business_id = target_business_id
      and sale_item.sale_id = new_sale_id
      and sale_item.item_source = 'catalogue'
      and product.track_inventory;
  end if;

  return query select new_sale_id, new_sale_number, final_total;
end;
$$;

create function public.create_pos_invoice(
  target_business_id uuid,
  selected_customer_id uuid,
  invoice_discount_amount numeric,
  items jsonb
)
returns table (
  invoice_id uuid,
  invoice_number text,
  total_amount numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  business_currency text;
  new_invoice_id uuid := gen_random_uuid();
  new_invoice_number text;
  subtotal numeric;
  final_total numeric;
begin
  if current_user_id is null
    or not public.is_business_member(target_business_id) then
    raise exception using errcode = '42501', message = 'You do not have access to this business.';
  end if;
  if invoice_discount_amount is null or invoice_discount_amount < 0 then
    raise exception using errcode = 'P0001', message = 'Enter a valid discount.';
  end if;

  select business.currency_code into business_currency
  from public.businesses as business
  where business.id = target_business_id;

  if selected_customer_id is not null and not exists (
    select 1 from public.customers as customer
    where customer.business_id = target_business_id
      and customer.id = selected_customer_id
  ) then
    raise exception using errcode = 'P0001', message = 'The selected customer is unavailable.';
  end if;

  select round(sum(normalized.line_gross), 4)
  into subtotal
  from public.normalize_pos_items(target_business_id, items) as normalized;

  if invoice_discount_amount > subtotal then
    raise exception using errcode = 'P0001', message = 'Discount cannot exceed the sale subtotal.';
  end if;

  final_total := round(subtotal - invoice_discount_amount, 4);
  new_invoice_number := 'INV-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
    || '-' || upper(left(replace(new_invoice_id::text, '-', ''), 6));

  insert into public.orders (
    id, business_id, customer_id, order_number, document_type, channel,
    status, payment_status, fulfillment_status, currency_code,
    subtotal_amount, discount_amount, tax_amount, shipping_amount,
    total_amount, placed_at, created_by
  ) values (
    new_invoice_id, target_business_id, selected_customer_id,
    new_invoice_number, 'invoice', 'pos', 'draft', 'unpaid',
    'unfulfilled', business_currency, subtotal, invoice_discount_amount,
    0, 0, final_total, now(), current_user_id
  );

  with normalized as materialized (
    select * from public.normalize_pos_items(target_business_id, items)
  ), ranked as (
    select normalized.*, max(line_index) over () as final_line
    from normalized
  ), provisional as (
    select ranked.*,
      case
        when line_index = final_line or subtotal = 0 then 0::numeric
        else least(
          invoice_discount_amount,
          round(invoice_discount_amount * line_gross / subtotal, 4)
        )
      end as provisional_discount
    from ranked
  ), allocated as (
    select provisional.*,
      case
        when line_index = final_line then
          invoice_discount_amount - sum(provisional_discount) over ()
        else provisional_discount
      end as line_discount
    from provisional
  )
  insert into public.order_items (
    business_id, order_id, item_source, product_id, variant_id,
    product_name, variant_name, sku, quantity, unit_price, discount_amount
  )
  select
    target_business_id, new_invoice_id, item_source, product_id, variant_id,
    product_name, variant_name, sku, quantity, unit_price, line_discount
  from allocated;

  return query select new_invoice_id, new_invoice_number, final_total;
end;
$$;

revoke all on function public.create_pos_invoice(uuid, uuid, numeric, jsonb)
  from public, anon;
grant execute on function public.create_pos_invoice(uuid, uuid, numeric, jsonb)
  to authenticated;

comment on function public.create_pos_invoice(uuid, uuid, numeric, jsonb) is
  'Creates an unpaid POS invoice in orders without recording a sale or inventory movement.';

notify pgrst, 'reload schema';
