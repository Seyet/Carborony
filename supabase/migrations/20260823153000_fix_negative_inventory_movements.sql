-- Allow valid negative movements while still preventing negative stock levels.
-- The previous INSERT ... ON CONFLICT trigger proposed a negative insert row,
-- causing the check constraint to fail before PostgreSQL resolved the conflict.

create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_level_id uuid;
begin
  update public.inventory_levels as level
  set quantity_on_hand = level.quantity_on_hand + new.quantity_delta,
      updated_at = now()
  where level.business_id = new.business_id
    and level.product_id = new.product_id
    and level.location_id = new.location_id
    and level.quantity_on_hand + new.quantity_delta >= 0
  returning level.id into updated_level_id;

  if updated_level_id is not null then
    return new;
  end if;

  if exists (
    select 1
    from public.inventory_levels as level
    where level.business_id = new.business_id
      and level.product_id = new.product_id
      and level.location_id = new.location_id
  ) or new.quantity_delta < 0 then
    raise exception using
      errcode = 'P0001',
      message = 'This operation would make stock negative.';
  end if;

  insert into public.inventory_levels as level (
    business_id,
    product_id,
    location_id,
    quantity_on_hand
  ) values (
    new.business_id,
    new.product_id,
    new.location_id,
    new.quantity_delta
  )
  on conflict (business_id, product_id, location_id)
  do update set
    quantity_on_hand = level.quantity_on_hand + excluded.quantity_on_hand,
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.apply_inventory_movement() from public;

notify pgrst, 'reload schema';
