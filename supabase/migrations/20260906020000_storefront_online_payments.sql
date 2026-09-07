-- Server-only payment ledger. Prices, destination and idempotency are fixed atomically with the order.
create table public.storefront_payments (
  reference text primary key default ('CB-' || replace(gen_random_uuid()::text, '-', '')),
  business_id uuid not null references public.businesses(id) on delete restrict,
  order_id uuid not null unique,
  order_number text not null,
  store_slug text not null,
  buyer_email text not null,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  provider_mode text not null check (provider_mode in ('test', 'live')),
  subaccount_code text not null,
  commission_percent numeric(5,2) not null check (commission_percent between 0 and 100),
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 9007199254740991),
  currency_code text not null check (currency_code = 'NGN'),
  status text not null default 'created' check (status in ('created', 'initializing', 'ready', 'paid', 'review')),
  authorization_url text,
  provider_transaction_id text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key),
  foreign key (business_id, order_id) references public.orders(business_id, id) on delete restrict
);
alter table public.storefront_payments enable row level security;
revoke all on public.storefront_payments from public, anon, authenticated;
grant select, insert, update on public.storefront_payments to service_role;

create function public.create_storefront_online_order(
  store_slug text, checkout_items jsonb, checkout_buyer_name text,
  checkout_buyer_email text, checkout_buyer_phone text,
  checkout_delivery_address text, checkout_delivery_method text,
  checkout_delivery_zone_id uuid, checkout_payment_method text,
  checkout_notes text, checkout_idempotency_key uuid,
  checkout_mode text, checkout_fingerprint text
)
returns setof public.storefront_payments
language plpgsql security definer set search_path = ''
as $$
declare
  storefront_record record;
  payout public.business_payment_accounts%rowtype;
  existing_payment public.storefront_payments%rowtype;
  normalized_name text := btrim(coalesce(checkout_buyer_name, ''));
  normalized_email text := lower(btrim(coalesce(checkout_buyer_email, '')));
  normalized_phone text := btrim(coalesce(checkout_buyer_phone, ''));
  normalized_address text := nullif(btrim(coalesce(checkout_delivery_address, '')), '');
  normalized_notes text := nullif(btrim(coalesce(checkout_notes, '')), '');
  resolved_customer_id uuid;
  created_order_id uuid := gen_random_uuid();
  created_order_number text;
  order_subtotal numeric;
  order_shipping numeric;
  order_total numeric;
  order_payment_method text;
  selected_delivery_zone_id uuid;
  selected_delivery_zone_name text;
  selected_delivery_fee numeric := 0;
  normalized record;
begin
  select business.id as business_id, business.created_by as owner_id,
    business.currency_code, storefront.delivery_enabled, storefront.pickup_enabled,
    storefront.pay_on_delivery_enabled, storefront.bank_transfer_enabled,
    storefront.bank_transfer_instructions
  into storefront_record
  from public.businesses as business
  join public.storefronts as storefront on storefront.business_id = business.id
  where business.slug = lower(btrim(store_slug)) and storefront.status = 'published'
  for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'This storefront is not available.';
  end if;
  if checkout_idempotency_key is null then
    raise exception using errcode = '22023', message = 'A checkout reference is required.';
  end if;
  if checkout_mode not in ('test', 'live') or checkout_mode is null
    or checkout_payment_method is distinct from 'online'
    or checkout_fingerprint is null or checkout_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid online checkout.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(storefront_record.business_id::text || checkout_idempotency_key::text, 0));
  select payment.* into existing_payment from public.storefront_payments as payment
  where payment.business_id = storefront_record.business_id and payment.idempotency_key = checkout_idempotency_key;
  if found then
    if existing_payment.request_fingerprint <> checkout_fingerprint or existing_payment.provider_mode <> checkout_mode then
      raise exception using errcode = '22023', message = 'This checkout reference is already in use.';
    end if;
    return next existing_payment;
    return;
  end if;
  if exists (select 1 from public.storefront_checkouts as checkout
    where checkout.business_id = storefront_record.business_id and checkout.idempotency_key = checkout_idempotency_key) then
    raise exception using errcode = '22023', message = 'This checkout reference is already in use.';
  end if;
  select account.* into payout from public.business_payment_accounts as account
  join public.businesses as business on business.id = account.business_id
  where account.business_id = storefront_record.business_id and account.provider_mode = checkout_mode
    and account.status = 'connected' and account.provider_active
    and business.country_code = 'NG' and business.currency_code = 'NGN'
  for share of account;
  if not found then
    raise exception using errcode = '22023', message = 'Online payment is unavailable for this store.';
  end if;
  if char_length(normalized_name) not between 2 and 120
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or char_length(normalized_phone) not between 7 and 32
    or normalized_phone !~ '^[0-9+(). -]+$' then
    raise exception using errcode = '22023', message = 'Enter valid customer contact details.';
  end if;
  if checkout_delivery_method not in ('delivery', 'pickup')
    or (checkout_delivery_method = 'delivery' and not storefront_record.delivery_enabled)
    or (checkout_delivery_method = 'pickup' and not storefront_record.pickup_enabled) then
    raise exception using errcode = '22023', message = 'Select an available fulfilment method.';
  end if;
  if checkout_delivery_method = 'delivery'
    and (normalized_address is null or char_length(normalized_address) not between 5 and 500) then
    raise exception using errcode = '22023', message = 'Enter a valid delivery address.';
  end if;
  if checkout_delivery_method = 'delivery' then
    select zone.id, zone.name, zone.delivery_fee
    into selected_delivery_zone_id, selected_delivery_zone_name, selected_delivery_fee
    from public.storefront_delivery_zones as zone
    where zone.business_id = storefront_record.business_id
      and zone.id = checkout_delivery_zone_id and zone.is_active;
    if not found then
      raise exception using errcode = '22023', message = 'Select an available delivery zone.';
    end if;
  elsif checkout_delivery_zone_id is not null then
    raise exception using errcode = '22023', message = 'Pickup orders do not use a delivery zone.';
  end if;
  if normalized_notes is not null and char_length(normalized_notes) > 500 then
    raise exception using errcode = '22023', message = 'Order notes must be 500 characters or fewer.';
  end if;
  order_payment_method := 'other';
  if exists (
    select 1 from jsonb_array_elements(checkout_items) as raw_item(value)
    group by value ->> 'product_id', coalesce(value ->> 'variant_id', '')
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'Each product option can appear only once in the cart.';
  end if;
  if exists (
    select 1 from public.normalize_pos_items(storefront_record.business_id, checkout_items) as item
    where not exists (
      select 1 from public.storefront_products as storefront_product
      where storefront_product.business_id = storefront_record.business_id
        and storefront_product.product_id = item.product_id and storefront_product.is_visible
    )
  ) then
    raise exception using errcode = '22023', message = 'A selected product is no longer available online.';
  end if;
  for normalized in select * from public.normalize_pos_items(storefront_record.business_id, checkout_items)
  loop
    if normalized.track_inventory and normalized.variant_id is not null
      and coalesce((select variant.stock_quantity from public.product_variants as variant
        where variant.business_id = storefront_record.business_id and variant.id = normalized.variant_id), 0) < normalized.quantity then
      raise exception using errcode = '22023', message = 'A selected product does not have enough stock.';
    elsif normalized.track_inventory and normalized.variant_id is null
      and coalesce((select sum(level.quantity_on_hand - level.quantity_reserved)
        from public.inventory_levels as level where level.business_id = storefront_record.business_id
          and level.product_id = normalized.product_id), 0) < normalized.quantity then
      raise exception using errcode = '22023', message = 'A selected product does not have enough stock.';
    end if;
  end loop;
  select round(sum(item.quantity * case when product.discount_price is not null
    and item.variant_id is null then product.discount_price else item.unit_price end), 4)
  into order_subtotal
  from public.normalize_pos_items(storefront_record.business_id, checkout_items) as item
  join public.products as product on product.business_id = storefront_record.business_id
    and product.id = item.product_id;
  order_shipping := selected_delivery_fee;
  order_total := round(order_subtotal + order_shipping, 2);
  if order_total <= 0 or order_total * 100 > 9007199254740991 then
    raise exception using errcode = '22023', message = 'The online payment amount is invalid.';
  end if;
  select customer.id into resolved_customer_id from public.customers as customer
  where customer.business_id = storefront_record.business_id
    and (lower(customer.email) = normalized_email or btrim(customer.phone) = normalized_phone)
  order by customer.created_at limit 1;
  if resolved_customer_id is null then
    insert into public.customers (business_id, full_name, email, phone, address, source, created_by)
    values (storefront_record.business_id, normalized_name, normalized_email, normalized_phone,
      normalized_address, 'storefront', storefront_record.owner_id)
    returning id into resolved_customer_id;
  else
    update public.customers as customer set full_name = normalized_name,
      address = coalesce(normalized_address, customer.address)
    where customer.business_id = storefront_record.business_id and customer.id = resolved_customer_id;
  end if;
  created_order_number := 'WEB-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
    || '-' || upper(left(replace(created_order_id::text, '-', ''), 6));
  insert into public.orders (
    id, business_id, customer_id, buyer_name, buyer_email, buyer_phone,
    delivery_address, delivery_zone_id, delivery_zone_name, order_number,
    document_type, channel, status, payment_status, payment_method,
    fulfillment_status, currency_code, subtotal_amount, discount_amount,
    tax_amount, shipping_amount, total_amount, notes, placed_at, created_by
  ) values (
    created_order_id, storefront_record.business_id, resolved_customer_id,
    normalized_name, normalized_email, normalized_phone, normalized_address,
    selected_delivery_zone_id, selected_delivery_zone_name, created_order_number,
    'order', 'storefront', 'pending', 'unpaid', order_payment_method,
    'unfulfilled', storefront_record.currency_code, order_subtotal, 0, 0,
    order_shipping, order_total,
    concat_ws(E'\n', 'Fulfilment: ' || checkout_delivery_method, normalized_notes), now(), null
  );
  insert into public.order_items (
    business_id, order_id, item_source, product_id, variant_id, product_name,
    variant_name, sku, quantity, unit_price, discount_amount
  )
  select storefront_record.business_id, created_order_id, item.item_source,
    item.product_id, item.variant_id, item.product_name, item.variant_name,
    item.sku, item.quantity, case when product.discount_price is not null
      and item.variant_id is null then product.discount_price else item.unit_price end, 0
  from public.normalize_pos_items(storefront_record.business_id, checkout_items) as item
  join public.products as product on product.business_id = storefront_record.business_id
    and product.id = item.product_id;
  insert into public.order_status_history (
    business_id, order_id, previous_status, new_status, note, changed_by
  ) values (
    storefront_record.business_id, created_order_id, null, 'pending',
    'Order placed through the online storefront', null
  );
  insert into public.storefront_checkouts (business_id, idempotency_key, order_id)
  values (storefront_record.business_id, checkout_idempotency_key, created_order_id);
  return query insert into public.storefront_payments (
    business_id, order_id, order_number, store_slug, buyer_email, idempotency_key,
    request_fingerprint, provider_mode, subaccount_code, commission_percent, amount_minor, currency_code
  ) values (
    storefront_record.business_id, created_order_id, created_order_number, lower(btrim(store_slug)),
    normalized_email, checkout_idempotency_key, checkout_fingerprint, checkout_mode,
    payout.subaccount_code, payout.commission_percent, (order_total * 100)::bigint, storefront_record.currency_code
  ) returning *;
end;
$$;

revoke all on function public.create_storefront_online_order(text, jsonb, text, text, text, text, text, uuid, text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_storefront_online_order(text, jsonb, text, text, text, text, text, uuid, text, text, uuid, text, text) to service_role;

-- Both callback verification and webhook delivery use the same locked, idempotent transition.
create function public.settle_storefront_payment(
  payment_reference text, verified_amount bigint, verified_currency text,
  verified_mode text, verified_transaction_id text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  payment public.storefront_payments%rowtype;
  current_order public.orders%rowtype;
  result_status text;
  inventory_owner_id uuid;
begin
  -- Orders are locked first, consistent with owner status updates and the guard trigger.
  select business_order.* into current_order from public.orders as business_order
  join public.storefront_payments as p on p.order_id = business_order.id
  where p.reference = payment_reference for update of business_order;
  select p.* into strict payment from public.storefront_payments as p
  where p.reference = payment_reference for update;
  if payment.amount_minor is distinct from verified_amount or payment.currency_code is distinct from verified_currency
    or payment.provider_mode is distinct from verified_mode
    or verified_transaction_id is null or verified_transaction_id !~ '^[0-9]+$' then
    raise exception using errcode = '22023', message = 'Payment verification mismatch.';
  end if;
  if payment.status in ('paid', 'review') then return payment.status; end if;
  result_status := case when current_order.status in ('cancelled', 'refunded')
    or current_order.total_amount * 100 <> payment.amount_minor
    or current_order.currency_code <> payment.currency_code then 'review' else 'paid' end;
  if result_status = 'paid' then
    begin
      -- Reuse the inventory movement's idempotency marker so completion cannot deduct twice.
      select business.created_by into inventory_owner_id from public.businesses as business where business.id = payment.business_id;
      perform public.consume_completed_order_inventory(payment.business_id, payment.order_id, inventory_owner_id);
    exception when sqlstate 'P0001' or check_violation then
      -- Money was received even when stock ran out while the buyer was at Paystack.
      -- The nested block rolls back all stock changes; retain the receipt for owner review.
      result_status := 'review';
    end;
  end if;
  update public.storefront_payments as p set status = result_status,
    provider_transaction_id = verified_transaction_id, paid_at = now()
  where p.reference = payment_reference;
  update public.orders as business_order set payment_status = 'paid'
  where business_order.id = payment.order_id;
  insert into public.order_status_history(business_id, order_id, previous_status, new_status, note, changed_by)
  values(payment.business_id, payment.order_id, current_order.status, current_order.status,
    case when result_status = 'review' then 'Paystack payment received; contact customer and review before fulfilment.'
      else 'Online payment verified with Paystack.' end, null);
  return result_status;
end;
$$;
revoke all on function public.settle_storefront_payment(text, bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.settle_storefront_payment(text, bigint, text, text, text) to service_role;

-- Manual order actions cannot manufacture online payments or refunds.
create function public.guard_storefront_payment_order() returns trigger
language plpgsql security definer set search_path = '' as $$
declare payment public.storefront_payments%rowtype;
begin
  select p.* into payment from public.storefront_payments as p where p.order_id = old.id;
  if not found then return new; end if;
  if new.total_amount is distinct from old.total_amount or new.currency_code is distinct from old.currency_code then
    raise exception using errcode = '22023', message = 'Online payment order totals cannot be changed.';
  end if;
  if new.payment_status is distinct from old.payment_status
    and not (new.payment_status = 'paid' and payment.status in ('paid', 'review')) then
    raise exception using errcode = '22023', message = 'Online payments and refunds must be verified with Paystack.';
  end if;
  if new.status is distinct from old.status and new.status in ('confirmed', 'processing', 'ready', 'completed')
    and payment.status <> 'paid' then
    raise exception using errcode = '22023', message = 'Verify the online payment before processing this order.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_storefront_payment_order() from public, anon, authenticated;
create trigger orders_guard_online_payment before update on public.orders
for each row execute function public.guard_storefront_payment_order();

create function public.guard_storefront_payment_items() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.storefront_payments as payment
    where payment.order_id = case when tg_op = 'INSERT' then new.order_id else old.order_id end)
    or (tg_op = 'UPDATE' and exists (select 1 from public.storefront_payments as payment where payment.order_id = new.order_id)) then
    raise exception using errcode = '22023', message = 'Online payment order items cannot be changed.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.guard_storefront_payment_items() from public, anon, authenticated;
create trigger order_items_guard_online_payment before insert or update or delete on public.order_items
for each row execute function public.guard_storefront_payment_items();

notify pgrst, 'reload schema';
