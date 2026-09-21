-- Consume tracked catalogue stock exactly once when an invoice is marked paid.
-- Orders and invoices share the same guarded inventory-consumption routine so
-- product totals, variant balances, and movement history stay in sync.

create function public.consume_order_document_inventory(
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
        (expected_document_type = 'order' and document.status = 'completed')
        or (expected_document_type = 'invoice' and document.payment_status = 'paid')
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

  -- A completed sale linked to this document already consumed its stock.
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
    else 'There is not enough stock to complete this order.'
  end;
  movement_note := case expected_document_type
    when 'invoice' then 'Stock consumed when invoice was marked paid'
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

create or replace function public.consume_completed_order_inventory(
  target_business_id uuid,
  target_order_id uuid,
  inventory_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.consume_order_document_inventory(
    target_business_id,
    target_order_id,
    inventory_actor_id,
    'order',
    'order_completion'
  );
end;
$$;

create function public.consume_paid_invoice_inventory(
  target_business_id uuid,
  target_invoice_id uuid,
  inventory_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.consume_order_document_inventory(
    target_business_id,
    target_invoice_id,
    inventory_actor_id,
    'invoice',
    'invoice_payment'
  );
end;
$$;

create function public.apply_paid_invoice_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.document_type = 'invoice'
    and new.payment_status = 'paid'
    and old.payment_status is distinct from 'paid' then
    perform public.consume_paid_invoice_inventory(
      new.business_id,
      new.id,
      coalesce((select auth.uid()), new.created_by)
    );
  end if;

  return new;
end;
$$;

create trigger orders_apply_paid_invoice_inventory
after update of payment_status on public.orders
for each row execute function public.apply_paid_invoice_inventory();

-- Bring invoices paid before this migration into the same inventory model.
do $$
declare
  paid_invoice record;
begin
  for paid_invoice in
    select invoice.business_id, invoice.id, invoice.created_by
    from public.orders as invoice
    where invoice.document_type = 'invoice'
      and invoice.payment_status = 'paid'
      and not exists (
        select 1
        from public.inventory_movements as movement
        where movement.business_id = invoice.business_id
          and movement.reference_type = 'invoice_payment'
          and movement.reference_id = invoice.id
      )
    order by invoice.placed_at, invoice.id
  loop
    perform public.consume_paid_invoice_inventory(
      paid_invoice.business_id,
      paid_invoice.id,
      paid_invoice.created_by
    );
  end loop;
end;
$$;

revoke all on function public.consume_order_document_inventory(
  uuid, uuid, uuid, text, text
) from public;
revoke all on function public.consume_completed_order_inventory(uuid, uuid, uuid)
  from public;
revoke all on function public.consume_paid_invoice_inventory(uuid, uuid, uuid)
  from public;
revoke all on function public.apply_paid_invoice_inventory()
  from public;

comment on function public.consume_order_document_inventory(
  uuid, uuid, uuid, text, text
) is 'Idempotently consumes tracked catalogue stock for a completed order document.';
comment on function public.consume_paid_invoice_inventory(uuid, uuid, uuid) is
  'Idempotently consumes tracked catalogue stock when an invoice is paid.';

notify pgrst, 'reload schema';
