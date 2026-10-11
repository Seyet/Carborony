-- Bound catalogue payloads before loading variant and media details. The existing
-- single-product RPC remains available for product pages and older clients.
create or replace function public.search_public_storefront_products(
  store_slug text,
  include_draft boolean default false,
  search_query text default '',
  selected_category_id uuid default null,
  result_limit integer default 24,
  result_offset integer default 0
)
returns table (
  products jsonb,
  categories jsonb,
  total_count bigint,
  store_count bigint,
  featured_count bigint
)
language sql stable security definer set search_path = ''
as $$
  with visible as materialized (
    select product.id, product.business_id, product.name,
      product.description, product.selling_price, product.discount_price,
      product.track_inventory, category.id as category_id,
      category.name as category_name, listing.is_featured, listing.position
    from public.businesses as business
    join public.storefronts as storefront on storefront.business_id = business.id
    join public.storefront_products as listing
      on listing.business_id = business.id and listing.is_visible
    join public.products as product
      on product.business_id = business.id and product.id = listing.product_id
      and product.status = 'active'
    left join public.categories as category
      on category.business_id = business.id and category.id = product.category_id
      and category.is_active
    where business.slug = lower(btrim(store_slug))
      and (storefront.status = 'published'
        or (include_draft and public.has_business_permission(business.id, 'settings.view')))
  ), filtered as materialized (
    select * from visible
    where (selected_category_id is null or category_id = selected_category_id)
      -- Literal substring matching preserves the old search semantics, including
      -- user-entered percent and underscore characters.
      and strpos(lower(name || ' ' || coalesce(description, '')),
        lower(left(btrim(coalesce(search_query, '')), 100))) > 0
  ), page as materialized (
    select * from filtered
    order by is_featured desc, position, name, id
    limit greatest(1, least(coalesce(result_limit, 24), 48))
    offset greatest(0, least(coalesce(result_offset, 0), 240000))
  ), cards as (
    select page.id as product_id, page.name as product_name,
      left(page.description, 240) as description,
      page.category_id, page.category_name, page.selling_price,
      page.discount_price, '{}'::jsonb as specifications,
      page.track_inventory, page.is_featured, page.position,
      case when page.track_inventory then coalesce((
        select sum(level.quantity_on_hand - level.quantity_reserved)
        from public.inventory_levels as level
        where level.business_id = page.business_id and level.product_id = page.id
      ), 0) else null end as available_stock,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', variant.id, 'selling_price', variant.selling_price,
          'stock_quantity', variant.stock_quantity
        ) order by variant.id)
        from public.product_variants as variant
        where variant.business_id = page.business_id and variant.product_id = page.id
          and variant.is_active
      ), '[]'::jsonb) as variants,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'storage_path', thumbnail.storage_path, 'media_kind', 'image',
          'variant_id', null
        )) from (
          select media.storage_path
          from public.product_media as media
          where media.business_id = page.business_id and media.product_id = page.id
            and media.media_kind = 'image'
            and (media.variant_id is null or exists (
              select 1 from public.product_variants as variant
              where variant.business_id = page.business_id and variant.product_id = page.id
                and variant.id = media.variant_id and variant.is_active
            ))
          order by (media.variant_id is null) desc, media.is_primary desc,
            media.position, media.created_at, media.id
          limit 1
        ) as thumbnail
      ), '[]'::jsonb) as media
    from page
  )
  select
    coalesce((select jsonb_agg(to_jsonb(cards) - 'position'
      order by is_featured desc, position, product_name, product_id) from cards), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(category) order by category.name, category.id)
      from (select distinct category_id as id, category_name as name
        from visible where category_id is not null) as category), '[]'::jsonb),
    (select count(*) from filtered),
    (select count(*) from visible),
    (select count(*) from filtered where is_featured);
$$;

revoke all on function public.search_public_storefront_products(text, boolean, text, uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.search_public_storefront_products(text, boolean, text, uuid, integer, integer)
  to anon, authenticated;

notify pgrst, 'reload schema';
