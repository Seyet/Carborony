-- Retry previously verified payments before advancing an order. Reviews caused
-- by repaired inventory data can resolve without another Paystack request.

create or replace function public.update_order_status(
  target_business_id uuid,
  target_order_id uuid,
  requested_status text,
  status_note text default null
)
returns table (
  order_id uuid,
  order_number text,
  previous_status text,
  current_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  order_record record;
  online_payment public.storefront_payments%rowtype;
  online_payment_reference text;
  normalized_note text := nullif(btrim(status_note), '');
  transition_allowed boolean := false;
begin
  if current_user_id is null
    or not public.has_business_permission(target_business_id, 'sales.manage') then
    raise exception using errcode = '42501', message = 'You do not have permission to update orders.';
  end if;
  if requested_status not in (
    'confirmed', 'processing', 'ready', 'completed', 'cancelled', 'refunded'
  ) then
    raise exception using errcode = 'P0001', message = 'Select a valid order status.';
  end if;
  if normalized_note is not null and char_length(normalized_note) > 500 then
    raise exception using errcode = 'P0001', message = 'Status notes must be 500 characters or fewer.';
  end if;

  select business_order.id, business_order.order_number,
    business_order.status, business_order.payment_status
  into order_record
  from public.orders as business_order
  where business_order.business_id = target_business_id
    and business_order.id = target_order_id
    and business_order.document_type = 'order'
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'This order could not be found.';
  end if;

  transition_allowed := case order_record.status
    when 'pending' then requested_status in ('confirmed', 'cancelled')
    when 'confirmed' then requested_status in ('processing', 'cancelled')
    when 'processing' then requested_status in ('ready', 'cancelled')
    when 'ready' then requested_status in ('completed', 'cancelled')
    when 'completed' then requested_status = 'refunded'
    else false
  end;

  if not transition_allowed then
    raise exception using errcode = 'P0001', message = 'This order status transition is not allowed.';
  end if;
  if requested_status = 'cancelled' and order_record.payment_status = 'paid' then
    raise exception using errcode = 'P0001', message = 'A paid order must be refunded instead of cancelled.';
  end if;

  if requested_status in ('confirmed', 'processing', 'ready', 'completed') then
    select payment.*
    into online_payment
    from public.storefront_payments as payment
    where payment.business_id = target_business_id
      and payment.order_id = target_order_id
    for update;

    if found then
      online_payment_reference := online_payment.reference;
      if online_payment.status = 'review'
        and online_payment.provider_transaction_id is not null
        and online_payment.paid_at is not null then
        begin
          perform public.settle_storefront_payment(
            online_payment.reference,
            online_payment.amount_minor,
            online_payment.currency_code,
            online_payment.provider_mode,
            online_payment.provider_transaction_id
          );
        exception when others then
          -- The verified payment remains reviewable and the status change below
          -- stays blocked if legacy data still prevents settlement.
          null;
        end;

        select payment.*
        into online_payment
        from public.storefront_payments as payment
        where payment.reference = online_payment_reference;
      end if;

      if online_payment.status = 'review' then
        if coalesce(online_payment.review_reason, '') ~* '(stock|inventory)' then
          raise exception using
            errcode = '22023',
            message = 'This paid order needs inventory review before processing. Update its stock, then try again.';
        end if;
        raise exception using
          errcode = '22023',
          message = 'This paid order needs payment review before processing. Contact support before fulfilment.';
      elsif online_payment.status <> 'paid' then
        raise exception using
          errcode = '22023',
          message = 'Verify the online payment before processing this order.';
      end if;
    end if;
  end if;

  update public.orders as business_order
  set status = requested_status,
      fulfillment_status = case requested_status
        when 'processing' then 'processing'
        when 'ready' then 'ready'
        when 'completed' then 'fulfilled'
        when 'cancelled' then 'cancelled'
        else business_order.fulfillment_status
      end,
      payment_status = case requested_status
        when 'refunded' then 'refunded'
        else business_order.payment_status
      end,
      completed_at = case requested_status
        when 'completed' then coalesce(business_order.completed_at, now())
        else business_order.completed_at
      end
  where business_order.business_id = target_business_id
    and business_order.id = target_order_id;

  insert into public.order_status_history (
    business_id, order_id, previous_status, new_status, note, changed_by
  ) values (
    target_business_id, target_order_id, order_record.status,
    requested_status, normalized_note, current_user_id
  );

  return query select
    order_record.id::uuid,
    order_record.order_number::text,
    order_record.status::text,
    requested_status;
end;
$$;

revoke all on function public.update_order_status(uuid, uuid, text, text)
  from public, anon;
grant execute on function public.update_order_status(uuid, uuid, text, text)
  to authenticated;

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
    and new.status in ('confirmed', 'processing', 'ready', 'completed') then
    if payment.status = 'review' then
      raise exception using errcode = '22023', message = 'This paid order needs payment review before processing. Contact support before fulfilment.';
    elsif payment.status <> 'paid' then
      raise exception using errcode = '22023', message = 'Verify the online payment before processing this order.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_storefront_payment_order()
  from public, anon, authenticated;

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
  if not public.is_business_member(target_business_id) then
    raise exception using errcode = '42501', message = 'You do not have access to this business.';
  end if;

  return query
  select payment.reference, payment.status, payment.review_reason
  from public.storefront_payments as payment
  where payment.business_id = target_business_id
    and payment.order_id = target_order_id;
end;
$$;

revoke all on function public.get_order_payment_state(uuid, uuid)
  from public, anon;
grant execute on function public.get_order_payment_state(uuid, uuid)
  to authenticated;

-- The stock-normalization migration runs after the original review repair, so
-- retry those verified rows once more with the normalized inventory values.
do $$
declare
  reviewed_payment record;
begin
  for reviewed_payment in
    select payment.reference,
      payment.amount_minor,
      payment.currency_code,
      payment.provider_mode,
      payment.provider_transaction_id
    from public.storefront_payments as payment
    where payment.status = 'review'
      and payment.provider_transaction_id is not null
      and payment.paid_at is not null
    order by payment.created_at, payment.reference
  loop
    begin
      perform public.settle_storefront_payment(
        reviewed_payment.reference,
        reviewed_payment.amount_minor,
        reviewed_payment.currency_code,
        reviewed_payment.provider_mode,
        reviewed_payment.provider_transaction_id
      );
    exception when others then
      null;
    end;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
