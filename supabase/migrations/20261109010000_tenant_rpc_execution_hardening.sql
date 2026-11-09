-- Tighten reviewed RPC permissions and remove inherited/default execution grants.
-- Core RLS/storage policies are inspected separately; this migration does not replace them.
begin;


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
    or not public.has_business_permission(target_business_id, 'sales.manage') then
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

create or replace function public.create_pos_invoice(
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
    or not public.has_business_permission(target_business_id, 'sales.manage') then
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

create or replace function public.get_order_payment_state(
  target_business_id uuid,
  target_order_id uuid
)
returns table (
  payment_reference text,
  verified_status text,
  review_reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_business_permission(target_business_id, 'sales.view') then
    raise exception using errcode = '42501', message = 'You do not have access to this business.';
  end if;

  return query
  select payment.reference, payment.status, payment.review_reason
  from public.storefront_payments as payment
  where payment.business_id = target_business_id
    and payment.order_id = target_order_id;
end;
$$;

do $audit_grants$
declare
  entry record;
  function_oid regprocedure;
begin
  for entry in select * from (values


    ('public.normalize_pos_items(uuid,jsonb)', ''),
    ('public.complete_pos_sale(uuid,uuid,text,numeric,jsonb)', 'authenticated'),
    ('public.create_pos_invoice(uuid,uuid,numeric,jsonb)', 'authenticated'),
    ('public.apply_inventory_movement()', ''),
    ('public.consume_completed_order_inventory(uuid,uuid,uuid)', ''),
    ('public.apply_completed_order_inventory()', ''),
    ('public.consume_order_document_inventory(uuid,uuid,uuid,text,text)', ''),
    ('public.consume_paid_invoice_inventory(uuid,uuid,uuid)', ''),
    ('public.apply_paid_invoice_inventory()', ''),
    ('public.create_instagram_oauth_state(uuid,text,text,timestamptz)', 'authenticated'),
    ('public.consume_instagram_oauth_state(text)', 'authenticated'),
    ('public.complete_instagram_connection(uuid,uuid,jsonb,text,text,integer,timestamptz)', 'service_role'),
    ('public.get_instagram_connection_credential(uuid,integer)', 'service_role'),
    ('public.replace_instagram_connection_credential(uuid,integer,text,text,integer,timestamptz)', 'service_role'),
    ('public.start_instagram_sync_run(uuid,uuid,uuid)', 'service_role'),
    ('public.set_instagram_connection_preferences(uuid,boolean)', 'authenticated'),
    ('public.disconnect_instagram_connection(uuid,uuid,integer)', 'service_role'),
    ('public.ingest_instagram_media(uuid,uuid,integer,jsonb,jsonb,jsonb)', 'service_role'),
    ('public.save_instagram_product_draft(uuid,uuid,jsonb)', 'authenticated'),
    ('public.approve_instagram_product_draft(uuid,uuid,text,boolean)', 'authenticated'),
    ('public.attach_instagram_draft_to_product(uuid,uuid,uuid)', 'authenticated'),
    ('public.resolve_instagram_product_draft(uuid,uuid,text)', 'authenticated'),
    ('public.create_storefront_online_order(text,jsonb,text,text,text,text,text,uuid,text,text,uuid,text,text)', 'service_role'),
    ('public.settle_storefront_payment(text,bigint,text,text,text)', 'service_role'),
    ('public.guard_storefront_payment_order()', ''),
    ('public.guard_storefront_payment_items()', ''),
    ('public.set_online_order_payment_method()', ''),
    ('public.update_order_status(uuid,uuid,text,text)', 'authenticated'),
    ('public.get_order_payment_state(uuid,uuid)', 'authenticated'),
    ('public.search_public_storefront_products(text,boolean,text,uuid,integer,integer)', 'anon,authenticated'),
    ('public.dashboard_revenue_documents(uuid,date,date)', ''),
    ('public.dashboard_revenue_items(uuid,date,date)', ''),
    ('public.get_dashboard_metrics_all_channels(uuid,date,date)', 'authenticated'),
    ('public.get_dashboard_sales_overview_all_channels(uuid,date,date)', 'authenticated'),
    ('public.get_dashboard_top_products_all_channels(uuid,date,date,integer)', 'authenticated'),
    ('public.get_dashboard_recent_transactions_all_channels(uuid,date,date,integer)', 'authenticated')


  ) as reviewed(signature, allowed_roles)
  loop
    function_oid := to_regprocedure(entry.signature);
    if function_oid is null then
      raise notice 'Optional reviewed function absent: %', entry.signature;
      continue;
    end if;
    execute format('revoke all on function %s from public, anon, authenticated, service_role', function_oid);
    if entry.allowed_roles <> '' then
      execute format('grant execute on function %s to %s', function_oid, entry.allowed_roles);
    end if;
  end loop;
end;
$audit_grants$;
notify pgrst, 'reload schema';
commit;
