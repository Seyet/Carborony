-- Apply final settlement and order-integrity guards to existing online-payment installs.

alter table public.orders
  drop constraint if exists orders_payment_method_check,
  add constraint orders_payment_method_check check (
    payment_method is null or payment_method in (
      'cash', 'bank_transfer', 'pos', 'card', 'online', 'other'
    )
  );

create or replace function public.set_online_order_payment_method()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.orders as business_order
  set payment_method = 'online'
  where business_order.business_id = new.business_id
    and business_order.id = new.order_id;
  return new;
end;
$$;

revoke all on function public.set_online_order_payment_method()
  from public, anon, authenticated;
drop trigger if exists storefront_payments_set_order_method on public.storefront_payments;
create trigger storefront_payments_set_order_method
after insert on public.storefront_payments
for each row execute function public.set_online_order_payment_method();

update public.orders as business_order
set payment_method = 'online'
from public.storefront_payments as payment
where payment.business_id = business_order.business_id
  and payment.order_id = business_order.id
  and business_order.payment_method is distinct from 'online';

create or replace function public.settle_storefront_payment(
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
  select business_order.* into current_order from public.orders as business_order
  join public.storefront_payments as p on p.order_id = business_order.id
  where p.reference = payment_reference for update of business_order;
  select p.* into strict payment from public.storefront_payments as p
  where p.reference = payment_reference for update;
  if payment.amount_minor is distinct from verified_amount
    or payment.currency_code is distinct from verified_currency
    or payment.provider_mode is distinct from verified_mode
    or verified_transaction_id is null
    or verified_transaction_id !~ '^[0-9]+$' then
    raise exception using errcode = '22023', message = 'Payment verification mismatch.';
  end if;
  if payment.status in ('paid', 'review') then return payment.status; end if;

  result_status := case when current_order.status in ('cancelled', 'refunded')
    or current_order.total_amount * 100 <> payment.amount_minor
    or current_order.currency_code <> payment.currency_code then 'review' else 'paid' end;
  if result_status = 'paid' then
    begin
      select business.created_by into inventory_owner_id
      from public.businesses as business where business.id = payment.business_id;
      perform public.consume_completed_order_inventory(
        payment.business_id, payment.order_id, inventory_owner_id
      );
    exception when sqlstate 'P0001' or check_violation then
      result_status := 'review';
    end;
  end if;

  update public.storefront_payments as p set status = result_status,
    provider_transaction_id = verified_transaction_id, paid_at = now()
  where p.reference = payment_reference;
  update public.orders as business_order set payment_status = 'paid'
  where business_order.id = payment.order_id;
  insert into public.order_status_history(
    business_id, order_id, previous_status, new_status, note, changed_by
  ) values (
    payment.business_id, payment.order_id, current_order.status, current_order.status,
    case when result_status = 'review'
      then 'Paystack payment received; contact customer and review before fulfilment.'
      else 'Online payment verified with Paystack.' end,
    null
  );
  return result_status;
end;
$$;

revoke all on function public.settle_storefront_payment(text, bigint, text, text, text)
  from public, anon, authenticated;
grant execute on function public.settle_storefront_payment(text, bigint, text, text, text)
  to service_role;

create or replace function public.guard_storefront_payment_order()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare payment public.storefront_payments%rowtype;
begin
  select p.* into payment from public.storefront_payments as p where p.order_id = old.id;
  if not found then return new; end if;
  if new.total_amount is distinct from old.total_amount
    or new.currency_code is distinct from old.currency_code then
    raise exception using errcode = '22023', message = 'Online payment order totals cannot be changed.';
  end if;
  if new.payment_status is distinct from old.payment_status
    and not (new.payment_status = 'paid' and payment.status in ('paid', 'review')) then
    raise exception using errcode = '22023', message = 'Online payments and refunds must be verified with Paystack.';
  end if;
  if new.status is distinct from old.status
    and new.status in ('confirmed', 'processing', 'ready', 'completed')
    and payment.status <> 'paid' then
    raise exception using errcode = '22023', message = 'Verify the online payment before processing this order.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_storefront_payment_order()
  from public, anon, authenticated;
drop trigger if exists orders_guard_online_payment on public.orders;
create trigger orders_guard_online_payment before update on public.orders
for each row execute function public.guard_storefront_payment_order();

create or replace function public.guard_storefront_payment_items()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.storefront_payments as payment
    where payment.order_id = case when tg_op = 'INSERT' then new.order_id else old.order_id end
  ) or (
    tg_op = 'UPDATE' and exists (
      select 1 from public.storefront_payments as payment where payment.order_id = new.order_id
    )
  ) then
    raise exception using errcode = '22023', message = 'Online payment order items cannot be changed.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.guard_storefront_payment_items()
  from public, anon, authenticated;
drop trigger if exists order_items_guard_online_payment on public.order_items;
create trigger order_items_guard_online_payment before insert or update or delete on public.order_items
for each row execute function public.guard_storefront_payment_items();

notify pgrst, 'reload schema';
