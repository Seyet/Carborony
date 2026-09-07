-- Include active variant price ranges in the paginated catalogue query.

drop function if exists public.search_catalogue_products(
  uuid, text, text, uuid, integer, integer
);

create function public.search_catalogue_products(
  target_business_id uuid,
  search_query text default null,
  selected_status text default null,
  selected_category_id uuid default null,
  result_limit integer default 20,
  result_offset integer default 0
)
returns table (
  product_id uuid,
  product_name text,
  product_sku text,
  product_status text,
  selling_price numeric,
  discount_price numeric,
  category_id uuid,
  category_name text,
  stock_quantity numeric,
  low_stock_threshold numeric,
  tracks_inventory boolean,
  variant_count bigint,
  variant_min_price numeric,
  variant_max_price numeric,
  primary_media_path text,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  normalized_search_query text := nullif(lower(btrim(search_query)), '');
begin
  if not public.is_business_member(target_business_id) then
    raise exception using errcode = '42501', message = 'You do not have access to this business.';
  end if;
  if result_limit < 1 or result_limit > 100 or result_offset < 0 then
    raise exception using errcode = 'P0001', message = 'Enter valid catalogue pagination.';
  end if;
  if normalized_search_query is not null and char_length(normalized_search_query) > 100 then
    raise exception using errcode = 'P0001', message = 'Search must be 100 characters or fewer.';
  end if;
  if selected_status is not null and selected_status not in ('draft', 'active', 'archived') then
    raise exception using errcode = 'P0001', message = 'Select a valid product status.';
  end if;

  return query
  select
    product.id,
    product.name,
    product.sku,
    product.status,
    product.selling_price,
    product.discount_price,
    product.category_id,
    category.name,
    coalesce(stock.quantity, 0),
    product.reorder_level,
    product.track_inventory,
    coalesce(variants.variant_count, 0),
    variants.minimum_price,
    variants.maximum_price,
    media.storage_path,
    count(*) over ()::bigint
  from public.products as product
  left join public.categories as category
    on category.business_id = product.business_id
    and category.id = product.category_id
  left join lateral (
    select sum(level.quantity_on_hand) as quantity
    from public.inventory_levels as level
    where level.business_id = product.business_id
      and level.product_id = product.id
  ) as stock on true
  left join lateral (
    select
      count(*)::bigint as variant_count,
      min(variant.selling_price) as minimum_price,
      max(variant.selling_price) as maximum_price
    from public.product_variants as variant
    where variant.business_id = product.business_id
      and variant.product_id = product.id
      and variant.is_active
  ) as variants on true
  left join lateral (
    select product_media.storage_path
    from public.product_media
    where product_media.business_id = product.business_id
      and product_media.product_id = product.id
      and product_media.media_kind = 'image'
      and product_media.variant_id is null
    order by product_media.is_primary desc, product_media.position, product_media.created_at
    limit 1
  ) as media on true
  where product.business_id = target_business_id
    and (selected_status is null or product.status = selected_status)
    and (
      selected_category_id is null
      or product.category_id = selected_category_id
      or category.parent_id = selected_category_id
    )
    and (
      normalized_search_query is null
      or strpos(lower(concat_ws(
        ' ',
        product.name,
        product.sku,
        product.description,
        category.name,
        array_to_string(product.tags, ' ')
      )), normalized_search_query) > 0
    )
  order by product.updated_at desc, product.id desc
  limit result_limit
  offset result_offset;
end;
$$;

revoke all on function public.search_catalogue_products(
  uuid, text, text, uuid, integer, integer
) from public, anon;
grant execute on function public.search_catalogue_products(
  uuid, text, text, uuid, integer, integer
) to authenticated;

comment on function public.search_catalogue_products(
  uuid, text, text, uuid, integer, integer
) is 'Searches and paginates tenant-scoped catalogue products with active variant price ranges.';

notify pgrst, 'reload schema';
