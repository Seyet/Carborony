-- Resolve the PL/pgSQL output-column collision in draft ingestion.

create or replace function public.ingest_instagram_media(
  target_business_id uuid,
  target_connection_id uuid,
  target_connection_generation integer,
  media_payload jsonb,
  extraction_payload jsonb default '{}'::jsonb,
  confidence_payload jsonb default '{}'::jsonb
)
returns table (media_id uuid, draft_id uuid, was_created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_media_id uuid;
  saved_draft_id uuid;
  draft_was_created boolean := false;
  draft_status text;
  duplicate_uuid uuid := nullif(extraction_payload->>'duplicate_product_id', '')::uuid;
  duplicate_similarity numeric := nullif(extraction_payload->>'duplicate_score', '')::numeric;
  source_user_id uuid;
begin
  if coalesce(jsonb_typeof(media_payload), 'null') <> 'object'
    or coalesce(jsonb_typeof(extraction_payload), 'null') <> 'object'
    or coalesce(jsonb_typeof(confidence_payload), 'null') <> 'object'
    or pg_column_size(media_payload) > 65536
    or pg_column_size(extraction_payload) > 32768
    or pg_column_size(confidence_payload) > 32768 then
    raise exception using errcode = '22023', message = 'The Instagram import payload is invalid.';
  end if;

  select connection.connected_by into source_user_id
  from public.instagram_connections as connection
  where connection.id = target_connection_id
    and connection.business_id = target_business_id
    and connection.connection_generation = target_connection_generation
    and connection.status = 'connected'
  for share;
  if source_user_id is null then
    raise exception using errcode = '22023', message = 'The Instagram connection is unavailable.';
  end if;
  if duplicate_uuid is not null and not exists (
    select 1 from public.products as product
    where product.business_id = target_business_id and product.id = duplicate_uuid
  ) then
    raise exception using errcode = '22023', message = 'The duplicate product suggestion is invalid.';
  end if;
  if duplicate_similarity is not null and (duplicate_similarity < 0 or duplicate_similarity > 1) then
    raise exception using errcode = '22023', message = 'The duplicate product score is invalid.';
  end if;

  insert into public.instagram_media (
    business_id, connection_id, instagram_media_id, media_type,
    media_product_type, caption, permalink, source_media_url,
    source_thumbnail_url, staged_media_path, source_published_at,
    caption_hash, raw_metadata, processing_status, last_checked_at
  ) values (
    target_business_id, target_connection_id,
    btrim(media_payload->>'instagram_media_id'), media_payload->>'media_type',
    nullif(btrim(media_payload->>'media_product_type'), ''),
    nullif(media_payload->>'caption', ''), media_payload->>'permalink',
    nullif(media_payload->>'source_media_url', ''),
    nullif(media_payload->>'source_thumbnail_url', ''),
    nullif(media_payload->>'staged_media_path', ''),
    (media_payload->>'source_published_at')::timestamptz,
    media_payload->>'caption_hash',
    coalesce(media_payload->'raw_metadata', '{}'::jsonb),
    case when nullif(media_payload->>'staged_media_path', '') is null
      then 'drafted' else 'staged' end,
    now()
  )
  on conflict (business_id, instagram_media_id) do update set
    connection_id = excluded.connection_id,
    media_type = excluded.media_type,
    media_product_type = excluded.media_product_type,
    caption = excluded.caption,
    permalink = excluded.permalink,
    source_media_url = excluded.source_media_url,
    source_thumbnail_url = excluded.source_thumbnail_url,
    staged_media_path = coalesce(public.instagram_media.staged_media_path, excluded.staged_media_path),
    source_published_at = excluded.source_published_at,
    caption_hash = excluded.caption_hash,
    raw_metadata = excluded.raw_metadata,
    last_checked_at = now()
  returning id into saved_media_id;

  draft_status := case
    when duplicate_uuid is not null then 'possible_duplicate'
    when char_length(btrim(coalesce(extraction_payload->>'name', ''))) < 2
      or nullif(extraction_payload->>'category_id', '') is null
      or nullif(extraction_payload->>'selling_price', '') is null
      or nullif(extraction_payload->>'stock_quantity', '') is null
      then 'incomplete'
    else 'needs_review'
  end;

  insert into public.instagram_product_drafts (
    business_id, media_id, extracted_data, field_confidence, status,
    duplicate_product_id, duplicate_score, created_by
  ) values (
    target_business_id, saved_media_id,
    extraction_payload - 'duplicate_product_id' - 'duplicate_score',
    confidence_payload, draft_status, duplicate_uuid, duplicate_similarity,
    source_user_id
  )
  on conflict on constraint instagram_product_drafts_media_id_key do nothing
  returning id into saved_draft_id;

  if saved_draft_id is not null then
    draft_was_created := true;
  else
    select draft.id into strict saved_draft_id
    from public.instagram_product_drafts as draft
    where draft.media_id = saved_media_id;
  end if;

  return query select saved_media_id, saved_draft_id, draft_was_created;
end;
$$;

revoke all on function public.ingest_instagram_media(
  uuid, uuid, integer, jsonb, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.ingest_instagram_media(
  uuid, uuid, integer, jsonb, jsonb, jsonb
) to service_role;

-- Let connections blocked by this ingestion error retry immediately.
update public.instagram_connections
set next_sync_at = null
where status = 'connected'
  and last_error_code = 'SYNC_FAILED';

notify pgrst, 'reload schema';
