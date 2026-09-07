-- Allow verified online payments to consume inventory while their orders are pending.
-- The prior settlement called the completed-order inventory routine before moving the
-- order to completed, so every tracked online order was incorrectly sent to review.

alter table public.storefront_payments
  add column if not exists review_reason text;

create or replace function public.consume_order_document_inventory(
  target_business_id uuid,
  target_document_id uuid,
  inventory_actor_id uuid,
  expected_document_type text,
  movement_reference_type text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  default_location_id uuid;
  stock_item record;
  updated_variant_id uuid;
  stock_error_message text;
  movement_note text;
begin
  if expected_document_type not in ('order', 'invoice')
    or movement_reference_type not in ('order_completion', 'invoice_payment') then
    raise exception using
      errcode = 'P0001',
      message = 'The inventory document type is invalid.';
  end if;

  if not exists (
    select 1
    from public.orders as document
    where document.business_id = target_business_id
      and document.id = target_document_id
      and document.document_type = expected_document_type
      and (
        (
          expected_document_type = 'order'
          and (
            document.status = 'completed'
            or exists (
              select 1
              from public.storefront_payments as payment
              where payment.business_id = document.business_id
                and payment.order_id = document.id
                and payment.status = 'paid'
                and payment.provider_transaction_id is not null
                and payment.paid_at is not null
            )
          )
        )
        or (
          expected_document_type = 'invoice'
          and document.payment_status = 'paid'
        )
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'This inventory document is unavailable.';
  end if;

  if exists (
    select 1
    from public.inventory_movements as movement
    where movement.business_id = target_business_id
      and movement.reference_type = movement_reference_type
      and movement.reference_id = target_document_id
  ) then
    return;
  end if;

  if exists (
    select 1
    from public.sales as linked_sale
    where linked_sale.business_id = target_business_id
      and linked_sale.order_id = target_document_id
      and linked_sale.status = 'completed'
  ) then
    return;
  end if;

  if not exists (
    select 1
    from public.order_items as item
    join public.products as product
      on product.business_id = item.business_id
      and product.id = item.product_id
    where item.business_id = target_business_id
      and item.order_id = target_document_id
      and item.item_source = 'catalogue'
      and product.track_inventory
  ) then
    return;
  end if;

  select location.id
  into default_location_id
  from public.inventory_locations as location
  where location.business_id = target_business_id
    and location.is_default
    and location.is_active
  order by location.created_at, location.id
  limit 1
  for update;

  if default_location_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'A default inventory location is required.';
  end if;

  stock_error_message := case expected_document_type
    when 'invoice' then 'There is not enough stock to mark this invoice as paid.'
    else 'There is not enough stock to fulfil this paid order.'
  end;
  movement_note := case
    when expected_document_type = 'invoice'
      then 'Stock consumed when invoice was marked paid'
    when exists (
      select 1
      from public.storefront_payments as payment
      where payment.business_id = target_business_id
        and payment.order_id = target_document_id
        and payment.status = 'paid'
    ) then 'Stock consumed when online payment was verified'
    else 'Stock consumed when order was completed'
  end;

  for stock_item in
    select
      item.product_id,
      item.variant_id,
      product.cost_price,
      sum(item.quantity)::numeric as quantity
    from public.order_items as item
    join public.products as product
      on product.business_id = item.business_id
      and product.id = item.product_id
    where item.business_id = target_business_id
      and item.order_id = target_document_id
      and item.item_source = 'catalogue'
      and product.track_inventory
    group by item.product_id, item.variant_id, product.cost_price
    order by item.product_id, item.variant_id nulls first
  loop
    if stock_item.variant_id is not null then
      updated_variant_id := null;

      update public.product_variants as variant
      set stock_quantity = variant.stock_quantity - stock_item.quantity
      where variant.business_id = target_business_id
        and variant.product_id = stock_item.product_id
        and variant.id = stock_item.variant_id
        and variant.stock_quantity >= stock_item.quantity
      returning variant.id into updated_variant_id;

      if updated_variant_id is null then
        raise exception using
          errcode = 'P0001',
          message = stock_error_message;
      end if;
    end if;

    begin
      insert into public.inventory_movements (
        business_id,
        product_id,
        variant_id,
        location_id,
        movement_type,
        quantity_delta,
        unit_cost,
        reference_type,
        reference_id,
        note,
        created_by
      ) values (
        target_business_id,
        stock_item.product_id,
        stock_item.variant_id,
        default_location_id,
        'sale',
        -stock_item.quantity,
        stock_item.cost_price,
        movement_reference_type,
        target_document_id,
        movement_note,
        inventory_actor_id
      );
    exception
      when sqlstate 'P0001' then
        if sqlerrm = 'This operation would make stock negative.' then
          raise exception using
            errcode = 'P0001',
            message = stock_error_message;
        end if;
        raise;
    end;
  end loop;
end;
$$;

revoke all on function public.consume_order_document_inventory(
  uuid, uuid, uuid, text, text
) from public, anon, authenticated;

create or replace function public.settle_storefront_payment(
  payment_reference text,
  verified_amount bigint,
  verified_currency text,
  verified_mode text,
  verified_transaction_id text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.storefront_payments%rowtype;
  current_order public.orders%rowtype;
  previous_payment_status text;
  result_status text;
  inventory_owner_id uuid;
  settlement_review_reason text;
begin
  select business_order.*
  into strict current_order
  from public.orders as business_order
  join public.storefront_payments as p on p.order_id = business_order.id
  where p.reference = payment_reference
  for update of business_order;

  select p.*
  into strict payment
  from public.storefront_payments as p
  where p.reference = payment_reference
  for update;

  if payment.amount_minor is distinct from verified_amount
    or payment.currency_code is distinct from verified_currency
    or payment.provider_mode is distinct from verified_mode
    or verified_transaction_id is null
    or verified_transaction_id !~ '^[0-9]+$'
    or (
      payment.provider_transaction_id is not null
      and payment.provider_transaction_id is distinct from verified_transaction_id
    ) then
    raise exception using errcode = '22023', message = 'Payment verification mismatch.';
  end if;

  if payment.status = 'paid' then
    return payment.status;
  end if;

  previous_payment_status := payment.status;
  if current_order.status in ('cancelled', 'refunded') then
    result_status := 'review';
    settlement_review_reason := 'The order was cancelled or refunded before payment confirmation.';
  elsif current_order.total_amount * 100 <> payment.amount_minor
    or current_order.currency_code <> payment.currency_code then
    result_status := 'review';
    settlement_review_reason := 'The verified payment no longer matches the order total or currency.';
  else
    result_status := 'paid';
  end if;

  if result_status = 'paid' then
    begin
      -- The paid ledger state authorizes inventory consumption while the order
      -- remains pending. This update rolls back with the nested block on failure.
      update public.storefront_payments as p
      set status = 'paid',
        provider_transaction_id = verified_transaction_id,
        paid_at = coalesce(p.paid_at, now()),
        review_reason = null
      where p.reference = payment_reference;

      select business.created_by
      into strict inventory_owner_id
      from public.businesses as business
      where business.id = payment.business_id;

      perform public.consume_completed_order_inventory(
        payment.business_id,
        payment.order_id,
        inventory_owner_id
      );
    exception
      when sqlstate 'P0001' or check_violation then
        get stacked diagnostics settlement_review_reason = message_text;
        result_status := 'review';
    end;
  end if;

  update public.storefront_payments as p
  set status = result_status,
    provider_transaction_id = verified_transaction_id,
    paid_at = coalesce(p.paid_at, now()),
    review_reason = case
      when result_status = 'review' then settlement_review_reason
      else null
    end
  where p.reference = payment_reference;

  update public.orders as business_order
  set payment_status = 'paid'
  where business_order.business_id = payment.business_id
    and business_order.id = payment.order_id;

  if previous_payment_status is distinct from result_status then
    insert into public.order_status_history (
      business_id,
      order_id,
      previous_status,
      new_status,
      note,
      changed_by
    ) values (
      payment.business_id,
      payment.order_id,
      current_order.status,
      current_order.status,
      case
        when result_status = 'review'
          then 'Paystack payment received; contact customer and review before fulfilment.'
        when previous_payment_status = 'review'
          then 'Online payment review resolved; inventory was recorded successfully.'
        else 'Online payment verified with Paystack.'
      end,
      null
    );
  end if;

  return result_status;
end;
$$;

revoke all on function public.settle_storefront_payment(
  text, bigint, text, text, text
) from public, anon, authenticated;
grant execute on function public.settle_storefront_payment(
  text, bigint, text, text, text
) to service_role;

-- Retry earlier review rows. They already contain a transaction ID written only
-- after server-side Paystack verification. Real stock/cancellation issues remain
-- in review and now retain their exact reason.
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
    join public.orders as business_order
      on business_order.business_id = payment.business_id
      and business_order.id = payment.order_id
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
      -- Keep the payment reviewable if unrelated legacy data prevents repair.
      null;
    end;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
