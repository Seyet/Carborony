-- Consume tracked catalogue stock exactly once when an order is completed.

create function public.consume_completed_order_inventory(
  target_business_id uuid,
  target_order_id uuid,
  inventory_actor_id uuid
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
begin
  if exists (
    select 1 from public.inventory_movements as movement
    where movement.business_id = target_business_id
      and movement.reference_type = 'order_completion'
      and movement.reference_id = target_order_id
  ) then
    return;
  end if;

  if exists (
    select 1 from public.sales as linked_sale
    where linked_sale.business_id = target_business_id
      and linked_sale.order_id = target_order_id
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
      and item.order_id = target_order_id
      and item.item_source = 'catalogue'
      and product.track_inventory
  ) then
    return;
  end if;

  select location.id into default_location_id
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

  for stock_item in
    select item.product_id, item.variant_id, product.name as product_name,
      product.cost_price, sum(item.quantity)::numeric as quantity
    from public.order_items as item
    join public.products as product
      on product.business_id = item.business_id
      and product.id = item.product_id
    where item.business_id = target_business_id
      and item.order_id = target_order_id
      and item.item_source = 'catalogue'
      and product.track_inventory
    group by item.product_id, item.variant_id, product.name, product.cost_price
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
          message = 'There is not enough stock to complete this order.';
      end if;
    end if;

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
      'order_completion',
      target_order_id,
      'Stock consumed when order was completed',
      inventory_actor_id
    );
  end loop;
end;
$$;

create function public.apply_completed_order_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.document_type = 'order'
    and new.status = 'completed'
    and old.status is distinct from 'completed' then
    perform public.consume_completed_order_inventory(
      new.business_id,
      new.id,
      coalesce((select auth.uid()), new.created_by)
    );
  end if;
  return new;
end;
$$;

create trigger orders_apply_completed_inventory
after update of status on public.orders
for each row execute function public.apply_completed_order_inventory();

do $$
declare
  completed_order record;
begin
  for completed_order in
    select business_order.business_id, business_order.id,
      business_order.created_by
    from public.orders as business_order
    where business_order.document_type = 'order'
      and business_order.status = 'completed'
      and not exists (
        select 1 from public.inventory_movements as movement
        where movement.business_id = business_order.business_id
          and movement.reference_type = 'order_completion'
          and movement.reference_id = business_order.id
      )
  loop
    perform public.consume_completed_order_inventory(
      completed_order.business_id,
      completed_order.id,
      completed_order.created_by
    );
  end loop;
end;
$$;

revoke all on function public.consume_completed_order_inventory(uuid, uuid, uuid)
  from public;
revoke all on function public.apply_completed_order_inventory()
  from public;

comment on function public.consume_completed_order_inventory(uuid, uuid, uuid) is
  'Idempotently consumes tracked catalogue stock for a completed order.';

notify pgrst, 'reload schema';
