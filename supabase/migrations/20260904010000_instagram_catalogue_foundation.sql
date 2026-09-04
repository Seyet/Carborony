-- Secure Instagram connection, rule-based import queue, and catalogue approval.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.instagram_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses (id) on delete cascade,
  instagram_user_id text not null,
  username text not null,
  account_type text not null,
  status text not null default 'connected',
  connection_generation integer not null default 1,
  granted_scopes text[] not null default '{}',
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  next_sync_at timestamptz,
  sync_enabled boolean not null default true,
  connected_by uuid not null references public.profiles (id) on delete restrict,
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instagram_connections_user_id_not_blank
    check (char_length(btrim(instagram_user_id)) between 1 and 128),
  constraint instagram_connections_username_format
    check (username ~ '^[A-Za-z0-9._]{1,100}$'),
  constraint instagram_connections_account_type_check
    check (account_type in ('business', 'creator')),
  constraint instagram_connections_status_check check (
    status in ('connected', 'disconnected', 'error', 'expired', 'needs_reauthorization')
  ),
  constraint instagram_connections_generation_positive
    check (connection_generation > 0),
  constraint instagram_connections_scopes_limit
    check (cardinality(granted_scopes) <= 16),
  constraint instagram_connections_error_limits check (
    (last_error_code is null or char_length(last_error_code) <= 100)
    and (last_error_message is null or char_length(last_error_message) <= 500)
  )
);

create unique index instagram_connections_instagram_user_active_key
  on public.instagram_connections (instagram_user_id)
  where status <> 'disconnected';

create trigger instagram_connections_set_updated_at
before update on public.instagram_connections
for each row execute function public.set_updated_at();

create table private.instagram_credentials (
  connection_id uuid primary key references public.instagram_connections (id) on delete cascade,
  encrypted_access_token text not null,
  token_fingerprint text not null,
  encryption_version integer not null,
  token_expires_at timestamptz,
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instagram_credentials_ciphertext_limit
    check (char_length(encrypted_access_token) between 32 and 8192),
  constraint instagram_credentials_fingerprint_format
    check (token_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint instagram_credentials_version_positive check (encryption_version > 0)
);

create trigger instagram_credentials_set_updated_at
before update on private.instagram_credentials
for each row execute function public.set_updated_at();

create table private.instagram_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  business_id uuid not null references public.businesses (id) on delete cascade,
  initiated_by uuid not null references public.profiles (id) on delete cascade,
  return_path text not null default '/app/settings?section=integrations',
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint instagram_oauth_states_hash_format check (state_hash ~ '^[a-f0-9]{64}$'),
  constraint instagram_oauth_states_return_path check (
    return_path ~ '^/app/' and return_path !~ '^//'
  ),
  constraint instagram_oauth_states_lifetime check (
    expires_at > created_at and expires_at <= created_at + interval '20 minutes'
  )
);

create index instagram_oauth_states_expiry_idx
  on private.instagram_oauth_states (expires_at)
  where consumed_at is null;

create table public.instagram_media (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  connection_id uuid not null references public.instagram_connections (id) on delete cascade,
  instagram_media_id text not null,
  media_type text not null,
  media_product_type text,
  caption text,
  permalink text not null,
  source_media_url text,
  source_thumbnail_url text,
  staged_media_path text,
  source_published_at timestamptz not null,
  caption_hash text not null,
  raw_metadata jsonb not null default '{}'::jsonb,
  processing_status text not null default 'detected',
  last_error text,
  first_detected_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instagram_media_business_media_key unique (business_id, instagram_media_id),
  constraint instagram_media_id_not_blank
    check (char_length(btrim(instagram_media_id)) between 1 and 128),
  constraint instagram_media_type_check
    check (media_type in ('image', 'video', 'reel', 'carousel')),
  constraint instagram_media_product_type_limit
    check (media_product_type is null or char_length(media_product_type) <= 50),
  constraint instagram_media_caption_limit
    check (caption is null or char_length(caption) <= 100000),
  constraint instagram_media_permalink_https check (permalink ~ '^https://'),
  constraint instagram_media_source_urls_https check (
    (source_media_url is null or source_media_url ~ '^https://')
    and (source_thumbnail_url is null or source_thumbnail_url ~ '^https://')
  ),
  constraint instagram_media_stage_path_limit
    check (staged_media_path is null or char_length(staged_media_path) between 1 and 1024),
  constraint instagram_media_caption_hash_format check (caption_hash ~ '^[a-f0-9]{64}$'),
  constraint instagram_media_metadata_shape check (
    jsonb_typeof(raw_metadata) = 'object' and pg_column_size(raw_metadata) <= 65536
  ),
  constraint instagram_media_processing_status_check check (
    processing_status in ('detected', 'drafted', 'staged', 'failed')
  ),
  constraint instagram_media_error_limit
    check (last_error is null or char_length(last_error) <= 500)
);

create index instagram_media_business_published_idx
  on public.instagram_media (business_id, source_published_at desc, id desc);

create trigger instagram_media_set_updated_at
before update on public.instagram_media
for each row execute function public.set_updated_at();

create table public.instagram_product_drafts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  media_id uuid not null unique references public.instagram_media (id) on delete cascade,
  extracted_data jsonb not null default '{}'::jsonb,
  edited_data jsonb not null default '{}'::jsonb,
  field_confidence jsonb not null default '{}'::jsonb,
  status text not null default 'needs_review',
  duplicate_product_id uuid,
  duplicate_score numeric(5, 4),
  approved_product_id uuid,
  approved_snapshot jsonb,
  extraction_version text not null default 'rules-v1',
  created_by uuid not null references public.profiles (id) on delete restrict,
  reviewed_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint instagram_product_drafts_duplicate_product_fkey
    foreign key (duplicate_product_id)
    references public.products (id) on delete set null,
  constraint instagram_product_drafts_approved_product_fkey
    foreign key (approved_product_id)
    references public.products (id) on delete set null,
  constraint instagram_product_drafts_json_shape check (
    jsonb_typeof(extracted_data) = 'object'
    and jsonb_typeof(edited_data) = 'object'
    and jsonb_typeof(field_confidence) = 'object'
    and pg_column_size(extracted_data) <= 32768
    and pg_column_size(edited_data) <= 32768
    and pg_column_size(field_confidence) <= 32768
  ),
  constraint instagram_product_drafts_status_check check (
    status in (
      'needs_review', 'incomplete', 'possible_duplicate', 'ready',
      'catalogue_draft', 'published', 'attached', 'ignored', 'failed'
    )
  ),
  constraint instagram_product_drafts_duplicate_score_check
    check (duplicate_score is null or duplicate_score between 0 and 1),
  constraint instagram_product_drafts_resolution_shape check (
    (status in ('catalogue_draft', 'published', 'attached', 'ignored') and resolved_at is not null)
    or (status not in ('catalogue_draft', 'published', 'attached', 'ignored') and resolved_at is null)
  )
);

create index instagram_product_drafts_business_queue_idx
  on public.instagram_product_drafts (business_id, status, created_at desc, id desc);

create trigger instagram_product_drafts_set_updated_at
before update on public.instagram_product_drafts
for each row execute function public.set_updated_at();

create table public.product_social_sources (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  product_id uuid not null,
  instagram_media_id uuid not null references public.instagram_media (id) on delete restrict,
  source_type text not null default 'instagram',
  source_permalink text not null,
  attached_by uuid not null references public.profiles (id) on delete restrict,
  attached_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint product_social_sources_product_fkey
    foreign key (business_id, product_id)
    references public.products (business_id, id) on delete cascade,
  constraint product_social_sources_instagram_key unique (business_id, instagram_media_id),
  constraint product_social_sources_type_check check (source_type = 'instagram'),
  constraint product_social_sources_permalink_https check (source_permalink ~ '^https://')
);

create index product_social_sources_product_idx
  on public.product_social_sources (business_id, product_id, attached_at desc);

create table public.instagram_sync_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  connection_id uuid not null references public.instagram_connections (id) on delete cascade,
  connection_generation integer not null,
  status text not null default 'running',
  posts_received integer not null default 0,
  posts_created integer not null default 0,
  posts_updated integer not null default 0,
  drafts_created integer not null default 0,
  error_code text,
  error_message text,
  cursor_before text,
  cursor_after text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint instagram_sync_runs_status_check
    check (status in ('running', 'completed', 'failed')),
  constraint instagram_sync_runs_counts_nonnegative check (
    posts_received >= 0 and posts_created >= 0
    and posts_updated >= 0 and drafts_created >= 0
  ),
  constraint instagram_sync_runs_generation_positive
    check (connection_generation > 0),
  constraint instagram_sync_runs_error_limits check (
    (error_code is null or char_length(error_code) <= 100)
    and (error_message is null or char_length(error_message) <= 500)
  )
);

create index instagram_sync_runs_business_started_idx
  on public.instagram_sync_runs (business_id, started_at desc, id desc);

create unique index instagram_sync_runs_connection_running_key
  on public.instagram_sync_runs (connection_id)
  where status = 'running';

alter table public.instagram_connections enable row level security;
alter table public.instagram_media enable row level security;
alter table public.instagram_product_drafts enable row level security;
alter table public.product_social_sources enable row level security;
alter table public.instagram_sync_runs enable row level security;
alter table private.instagram_credentials enable row level security;
alter table private.instagram_oauth_states enable row level security;

create policy instagram_connections_select_authorized
on public.instagram_connections for select to authenticated
using (
  public.has_business_permission(business_id, 'settings.view')
  or public.has_business_permission(business_id, 'products.view')
);

create policy instagram_media_select_product_viewers
on public.instagram_media for select to authenticated
using (public.has_business_permission(business_id, 'products.view'));

create policy instagram_product_drafts_select_product_viewers
on public.instagram_product_drafts for select to authenticated
using (public.has_business_permission(business_id, 'products.view'));

create policy product_social_sources_select_product_viewers
on public.product_social_sources for select to authenticated
using (public.has_business_permission(business_id, 'products.view'));

create policy instagram_sync_runs_select_product_viewers
on public.instagram_sync_runs for select to authenticated
using (public.has_business_permission(business_id, 'products.view'));

grant select on table
  public.instagram_connections,
  public.instagram_media,
  public.instagram_product_drafts,
  public.product_social_sources,
  public.instagram_sync_runs
to authenticated;

grant select, insert, update on table
  public.instagram_connections,
  public.instagram_media,
  public.instagram_product_drafts,
  public.product_social_sources,
  public.instagram_sync_runs
to service_role;
grant insert on table public.product_media to service_role;

revoke all on table private.instagram_credentials, private.instagram_oauth_states
  from public, anon, authenticated;

create function public.create_instagram_oauth_state(
  target_business_id uuid,
  target_state_hash text,
  target_return_path text default '/app/settings?section=integrations',
  target_expires_at timestamptz default (now() + interval '10 minutes')
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  saved_state_id uuid;
begin
  if current_user_id is null or not public.is_business_creator(target_business_id) then
    raise exception using errcode = '42501', message = 'Only the business owner can connect Instagram.';
  end if;
  if target_state_hash !~ '^[a-f0-9]{64}$'
    or target_return_path !~ '^/app/' or target_return_path ~ '^//'
    or target_expires_at <= now() or target_expires_at > now() + interval '20 minutes' then
    raise exception using errcode = '22023', message = 'The Instagram connection request is invalid.';
  end if;

  delete from private.instagram_oauth_states
  where expires_at <= now() or consumed_at is not null;

  insert into private.instagram_oauth_states (
    state_hash, business_id, initiated_by, return_path, expires_at
  ) values (
    target_state_hash, target_business_id, current_user_id,
    target_return_path, target_expires_at
  )
  returning id into saved_state_id;

  return saved_state_id;
end;
$$;

create function public.consume_instagram_oauth_state(target_state_hash text)
returns table (business_id uuid, initiated_by uuid, return_path text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return;
  end if;

  return query
  update private.instagram_oauth_states as oauth_state
  set consumed_at = now()
  where oauth_state.state_hash = target_state_hash
    and oauth_state.initiated_by = (select auth.uid())
    and oauth_state.consumed_at is null
    and oauth_state.expires_at > now()
  returning oauth_state.business_id, oauth_state.initiated_by, oauth_state.return_path;
end;
$$;

create function public.complete_instagram_connection(
  target_business_id uuid,
  target_connected_by uuid,
  instagram_account jsonb,
  encrypted_access_token text,
  target_token_fingerprint text,
  target_encryption_version integer,
  target_token_expires_at timestamptz
)
returns table (connection_id uuid, username text, connection_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_connection_id uuid;
  saved_connection_id uuid;
  normalized_account_type text := lower(btrim(instagram_account->>'account_type'));
  normalized_username text := btrim(instagram_account->>'username');
  normalized_user_id text := btrim(instagram_account->>'instagram_user_id');
  normalized_scopes text[];
begin
  if target_connected_by is null or not exists (
    select 1
    from public.businesses as business
    where business.id = target_business_id
      and business.created_by = target_connected_by
  ) then
    raise exception using errcode = '42501', message = 'Only the business owner can connect Instagram.';
  end if;
  if instagram_account is null or jsonb_typeof(instagram_account) <> 'object'
    or normalized_account_type not in ('business', 'creator')
    or coalesce(normalized_username, '') !~ '^[A-Za-z0-9._]{1,100}$'
    or char_length(coalesce(normalized_user_id, '')) not between 1 and 128
    or char_length(coalesce(encrypted_access_token, '')) not between 32 and 8192
    or coalesce(target_token_fingerprint, '') !~ '^[a-f0-9]{64}$'
    or coalesce(target_encryption_version, 0) <= 0
    or jsonb_typeof(coalesce(instagram_account->'granted_scopes', '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'The Instagram account details are invalid.';
  end if;

  select coalesce(array_agg(scope_value), '{}'::text[])
  into normalized_scopes
  from jsonb_array_elements_text(
    coalesce(instagram_account->'granted_scopes', '[]'::jsonb)
  ) as scopes(scope_value)
  where scope_value ~ '^[a-z_]{1,80}$';

  if not ('instagram_business_basic' = any(normalized_scopes)) then
    raise exception using errcode = '22023', message = 'Instagram did not grant the required basic permission.';
  end if;

  select connection.id into existing_connection_id
  from public.instagram_connections as connection
  where connection.business_id = target_business_id;

  if existing_connection_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(existing_connection_id::text, 0)
    );

    update public.instagram_sync_runs as sync_run
    set status = 'failed', completed_at = now(), error_code = 'CONNECTION_REPLACED',
        error_message = 'The Instagram connection changed during this sync.'
    where sync_run.connection_id = existing_connection_id
      and sync_run.status = 'running';
  end if;

  insert into public.instagram_connections as target_connection (
    business_id, instagram_user_id, username, account_type, status,
    granted_scopes, token_expires_at, sync_enabled, connected_by,
    connected_at, disconnected_at, last_error_code, last_error_message
  ) values (
    target_business_id, normalized_user_id, normalized_username,
    normalized_account_type, 'connected', normalized_scopes,
    target_token_expires_at, true, target_connected_by, now(), null, null, null
  )
  on conflict (business_id) do update set
    instagram_user_id = excluded.instagram_user_id,
    username = excluded.username,
    account_type = excluded.account_type,
    status = 'connected',
    connection_generation = target_connection.connection_generation + 1,
    granted_scopes = excluded.granted_scopes,
    token_expires_at = excluded.token_expires_at,
    sync_enabled = true,
    connected_by = excluded.connected_by,
    connected_at = now(),
    disconnected_at = null,
    last_error_code = null,
    last_error_message = null
  returning id into saved_connection_id;

  insert into private.instagram_credentials (
    connection_id, encrypted_access_token, token_fingerprint,
    encryption_version, token_expires_at, refreshed_at
  ) values (
    saved_connection_id, encrypted_access_token, target_token_fingerprint,
    target_encryption_version, target_token_expires_at, now()
  )
  on conflict (connection_id) do update set
    encrypted_access_token = excluded.encrypted_access_token,
    token_fingerprint = excluded.token_fingerprint,
    encryption_version = excluded.encryption_version,
    token_expires_at = excluded.token_expires_at,
    refreshed_at = now();

  return query select saved_connection_id, normalized_username, 'connected'::text;
end;
$$;

create function public.get_instagram_connection_credential(
  target_connection_id uuid,
  target_connection_generation integer
)
returns table (
  encrypted_access_token text,
  token_fingerprint text,
  encryption_version integer,
  token_expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select credential.encrypted_access_token, credential.token_fingerprint,
    credential.encryption_version, credential.token_expires_at
  from private.instagram_credentials as credential
  join public.instagram_connections as connection
    on connection.id = credential.connection_id
  where credential.connection_id = target_connection_id
    and connection.connection_generation = target_connection_generation;
$$;

create function public.replace_instagram_connection_credential(
  target_connection_id uuid,
  target_connection_generation integer,
  target_encrypted_access_token text,
  target_token_fingerprint text,
  target_encryption_version integer,
  target_token_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_connection_id::text, 0)
  );

  if not exists (
    select 1
    from public.instagram_connections as connection
    where connection.id = target_connection_id
      and connection.connection_generation = target_connection_generation
      and connection.status = 'connected'
  ) then
    raise exception using errcode = '55000', message = 'The Instagram connection changed during token refresh.';
  end if;

  update private.instagram_credentials as credential
  set encrypted_access_token = target_encrypted_access_token,
      token_fingerprint = target_token_fingerprint,
      encryption_version = target_encryption_version,
      token_expires_at = target_token_expires_at,
      refreshed_at = now()
  where credential.connection_id = target_connection_id;

  update public.instagram_connections as connection
  set token_expires_at = target_token_expires_at,
      status = 'connected',
      last_error_code = null,
      last_error_message = null
  where connection.id = target_connection_id
    and connection.connection_generation = target_connection_generation
    and connection.status = 'connected';
end;
$$;

create function public.start_instagram_sync_run(
  target_business_id uuid,
  target_connection_id uuid,
  target_actor_id uuid
)
returns table (run_id uuid, connection_generation integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_status text;
  connection_sync_enabled boolean;
  connection_next_sync_at timestamptz;
  current_connection_generation integer;
  saved_run_id uuid;
begin
  if target_actor_id is null or not exists (
    select 1
    from public.businesses as business
    where business.id = target_business_id
      and business.created_by = target_actor_id
  ) then
    raise exception using errcode = '42501', message = 'Only the business owner can sync Instagram.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_connection_id::text, 0)
  );

  select connection.status, connection.sync_enabled, connection.next_sync_at,
    connection.connection_generation
  into connection_status, connection_sync_enabled, connection_next_sync_at,
    current_connection_generation
  from public.instagram_connections as connection
  where connection.id = target_connection_id
    and connection.business_id = target_business_id
  for update;

  if not found or connection_status <> 'connected' or not connection_sync_enabled then
    raise exception using errcode = '55000', message = 'The Instagram connection is unavailable.';
  end if;

  update public.instagram_sync_runs as sync_run
  set status = 'failed', completed_at = now(), error_code = 'STALE_RUN',
      error_message = 'A previous Instagram sync did not complete.'
  where sync_run.connection_id = target_connection_id
    and sync_run.status = 'running'
    and sync_run.started_at < now() - interval '5 minutes';

  if exists (
    select 1
    from public.instagram_sync_runs as sync_run
    where sync_run.connection_id = target_connection_id
      and sync_run.status = 'running'
  ) then
    raise exception using errcode = '55006', message = 'An Instagram sync is already running.';
  end if;

  if connection_next_sync_at is not null and connection_next_sync_at > now() then
    raise exception using errcode = 'P0001', message = 'Instagram was synced recently. Try again shortly.';
  end if;

  insert into public.instagram_sync_runs (
    business_id, connection_id, connection_generation
  ) values (
    target_business_id, target_connection_id, current_connection_generation
  )
  returning id into saved_run_id;

  update public.instagram_connections
  set next_sync_at = now() + interval '1 minute'
  where id = target_connection_id;

  return query select saved_run_id, current_connection_generation;
end;
$$;

create function public.set_instagram_connection_preferences(
  target_business_id uuid,
  target_sync_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_business_creator(target_business_id) then
    raise exception using errcode = '42501', message = 'Only the business owner can change Instagram settings.';
  end if;
  update public.instagram_connections
  set sync_enabled = target_sync_enabled
  where business_id = target_business_id and status <> 'disconnected';
end;
$$;

create function public.disconnect_instagram_connection(
  target_business_id uuid,
  target_actor_id uuid,
  target_connection_generation integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_connection_id uuid;
begin
  if target_actor_id is null or not exists (
    select 1
    from public.businesses as business
    where business.id = target_business_id
      and business.created_by = target_actor_id
  ) then
    raise exception using errcode = '42501', message = 'Only the business owner can disconnect Instagram.';
  end if;

  select connection.id into saved_connection_id
  from public.instagram_connections as connection
  where connection.business_id = target_business_id
    and connection.connection_generation = target_connection_generation;
  if saved_connection_id is null then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(saved_connection_id::text, 0)
  );

  update public.instagram_connections
  set status = 'disconnected', connection_generation = connection_generation + 1,
      sync_enabled = false, disconnected_at = now(), token_expires_at = null,
      next_sync_at = null
  where id = saved_connection_id
    and connection_generation = target_connection_generation;
  if not found then
    return false;
  end if;

  update public.instagram_sync_runs as sync_run
  set status = 'failed', completed_at = now(), error_code = 'DISCONNECTED',
      error_message = 'Instagram was disconnected during this sync.'
  where sync_run.connection_id = saved_connection_id
    and sync_run.connection_generation = target_connection_generation
    and sync_run.status = 'running';

  delete from private.instagram_credentials where connection_id = saved_connection_id;
  return true;
end;
$$;

create function public.ingest_instagram_media(
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
  on conflict (media_id) do nothing
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

create function public.save_instagram_product_draft(
  target_business_id uuid,
  target_draft_id uuid,
  edited_product_data jsonb
)
returns table (draft_status text, effective_product_data jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_status text;
  has_duplicate boolean;
begin
  if not public.has_business_permission(target_business_id, 'products.manage') then
    raise exception using errcode = '42501', message = 'You do not have permission to review Instagram imports.';
  end if;
  if coalesce(jsonb_typeof(edited_product_data), 'null') <> 'object'
    or pg_column_size(edited_product_data) > 32768 then
    raise exception using errcode = '22023', message = 'Enter valid product details.';
  end if;

  select draft.duplicate_product_id is not null into has_duplicate
  from public.instagram_product_drafts as draft
  where draft.business_id = target_business_id
    and draft.id = target_draft_id
    and draft.status not in ('catalogue_draft', 'published', 'attached', 'ignored');
  if not found then
    raise exception using errcode = 'P0002', message = 'This Instagram draft could not be found.';
  end if;

  saved_status := case
    when has_duplicate then 'possible_duplicate'
    when char_length(btrim(coalesce(edited_product_data->>'name', ''))) < 2
      or nullif(edited_product_data->>'category_id', '') is null
      or nullif(edited_product_data->>'selling_price', '') is null
      or nullif(edited_product_data->>'stock_quantity', '') is null
      then 'incomplete'
    else 'ready'
  end;

  update public.instagram_product_drafts as draft
  set edited_data = edited_product_data,
      status = saved_status,
      reviewed_by = (select auth.uid())
  where draft.business_id = target_business_id and draft.id = target_draft_id;

  return query select saved_status, edited_product_data;
end;
$$;

-- A later catalogue migration replaced this function after staff permissions
-- were introduced. Restore the intended products.manage guard before the
-- Instagram approval function delegates product creation to it.
do $$
declare
  target_function record;
  function_definition text;
begin
  for target_function in
    select routine.oid
    from pg_catalog.pg_proc as routine
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname = 'save_catalogue_product'
      and routine.prokind = 'f'
  loop
    function_definition := pg_catalog.pg_get_functiondef(target_function.oid);
    if strpos(function_definition, 'public.is_business_creator(target_business_id)') > 0 then
      execute replace(
        function_definition,
        'public.is_business_creator(target_business_id)',
        'public.has_business_permission(target_business_id, ''products.manage'')'
      );
    end if;
  end loop;
end;
$$;

create function public.approve_instagram_product_draft(
  target_business_id uuid,
  target_draft_id uuid,
  requested_product_status text default 'draft',
  confirm_create_new boolean default false
)
returns table (product_id uuid, draft_status text, was_created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_draft public.instagram_product_drafts%rowtype;
  source_media public.instagram_media%rowtype;
  product_data jsonb;
  catalogue_data jsonb;
  saved_product record;
  category_uuid uuid;
  product_price numeric;
  product_discount numeric;
  product_stock numeric;
  saved_draft_status text;
begin
  if not public.has_business_permission(target_business_id, 'products.manage') then
    raise exception using errcode = '42501', message = 'You do not have permission to approve Instagram imports.';
  end if;
  if requested_product_status not in ('draft', 'active') then
    raise exception using errcode = '22023', message = 'Select a valid catalogue status.';
  end if;

  select * into source_draft
  from public.instagram_product_drafts as draft
  where draft.business_id = target_business_id and draft.id = target_draft_id
  for update;
  if not found or source_draft.status in ('catalogue_draft', 'published', 'attached', 'ignored') then
    raise exception using errcode = 'P0002', message = 'This Instagram draft is no longer available.';
  end if;
  if source_draft.duplicate_product_id is not null and not confirm_create_new then
    raise exception using errcode = '23505', message = 'Confirm whether to attach the post or create a new product.';
  end if;

  product_data := case when source_draft.edited_data = '{}'::jsonb
    then source_draft.extracted_data else source_draft.edited_data end;
  if char_length(btrim(coalesce(product_data->>'name', ''))) not between 2 and 160
    or nullif(product_data->>'category_id', '') is null
    or nullif(product_data->>'selling_price', '') is null
    or nullif(product_data->>'stock_quantity', '') is null
    or jsonb_typeof(coalesce(product_data->'colours', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(product_data->'sizes', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(product_data->'tags', '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'Complete the name, category, price, and stock before approval.';
  end if;

  category_uuid := (product_data->>'category_id')::uuid;
  product_price := (product_data->>'selling_price')::numeric;
  product_discount := nullif(product_data->>'discount_price', '')::numeric;
  product_stock := (product_data->>'stock_quantity')::numeric;
  if product_price < 0 or product_stock < 0
    or (product_discount is not null and (product_discount < 0 or product_discount > product_price)) then
    raise exception using errcode = '22023', message = 'Enter valid product pricing and stock values.';
  end if;
  if not exists (
    select 1 from public.categories as category
    where category.business_id = target_business_id
      and category.id = category_uuid and category.is_active
  ) then
    raise exception using errcode = '22023', message = 'Select a valid category.';
  end if;

  catalogue_data := jsonb_build_object(
    'category_id', category_uuid,
    'cost_price', 0,
    'description', nullif(btrim(product_data->>'description'), ''),
    'discount_price', product_discount,
    'low_stock_threshold', 0,
    'name', btrim(product_data->>'name'),
    'selling_price', product_price,
    'sku', nullif(btrim(product_data->>'sku'), ''),
    'specifications', jsonb_strip_nulls(jsonb_build_object(
      'Brand', case when nullif(btrim(product_data->>'brand'), '') is null then null
        else jsonb_build_object('unit', null, 'value', btrim(product_data->>'brand')) end,
      'Colours', case when jsonb_array_length(coalesce(product_data->'colours', '[]'::jsonb)) = 0 then null
        else jsonb_build_object('unit', null, 'value', array_to_string(array(
          select jsonb_array_elements_text(product_data->'colours')
        ), ', ')) end,
      'Sizes', case when jsonb_array_length(coalesce(product_data->'sizes', '[]'::jsonb)) = 0 then null
        else jsonb_build_object('unit', null, 'value', array_to_string(array(
          select jsonb_array_elements_text(product_data->'sizes')
        ), ', ')) end
    )),
    'status', requested_product_status,
    'stock_quantity', product_stock,
    'tags', coalesce(product_data->'tags', '[]'::jsonb),
    'track_inventory', true,
    'variants', '[]'::jsonb
  );

  select * into strict saved_product
  from public.save_catalogue_product(target_business_id, null, catalogue_data);

  select * into strict source_media
  from public.instagram_media as media where media.id = source_draft.media_id;

  insert into public.product_social_sources (
    business_id, product_id, instagram_media_id, source_permalink, attached_by
  ) values (
    target_business_id, saved_product.product_id, source_media.id,
    source_media.permalink, (select auth.uid())
  );

  saved_draft_status := case when requested_product_status = 'active'
    then 'published' else 'catalogue_draft' end;

  update public.instagram_product_drafts as draft
  set status = saved_draft_status, approved_product_id = saved_product.product_id,
      approved_snapshot = catalogue_data, reviewed_by = (select auth.uid()),
      resolved_at = now()
  where draft.id = target_draft_id;

  return query select saved_product.product_id, saved_draft_status,
    saved_product.was_created;
end;
$$;

create function public.attach_instagram_draft_to_product(
  target_business_id uuid,
  target_draft_id uuid,
  target_product_id uuid
)
returns table (product_id uuid, draft_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_media_id uuid;
  source_permalink text;
begin
  if not public.has_business_permission(target_business_id, 'products.manage') then
    raise exception using errcode = '42501', message = 'You do not have permission to attach Instagram posts.';
  end if;
  if not exists (
    select 1 from public.products as product
    where product.business_id = target_business_id and product.id = target_product_id
  ) then
    raise exception using errcode = 'P0002', message = 'The selected product could not be found.';
  end if;

  select media.id, media.permalink into source_media_id, source_permalink
  from public.instagram_product_drafts as draft
  join public.instagram_media as media on media.id = draft.media_id
  where draft.business_id = target_business_id and draft.id = target_draft_id
    and draft.status not in ('catalogue_draft', 'published', 'attached', 'ignored')
  for update of draft;
  if source_media_id is null then
    raise exception using errcode = 'P0002', message = 'This Instagram draft is no longer available.';
  end if;

  insert into public.product_social_sources (
    business_id, product_id, instagram_media_id, source_permalink, attached_by
  ) values (
    target_business_id, target_product_id, source_media_id,
    source_permalink, (select auth.uid())
  );

  update public.instagram_product_drafts
  set status = 'attached', approved_product_id = target_product_id,
      reviewed_by = (select auth.uid()), resolved_at = now()
  where id = target_draft_id;

  return query select target_product_id, 'attached'::text;
end;
$$;

create function public.resolve_instagram_product_draft(
  target_business_id uuid,
  target_draft_id uuid,
  target_resolution text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_business_permission(target_business_id, 'products.manage') then
    raise exception using errcode = '42501', message = 'You do not have permission to resolve Instagram imports.';
  end if;
  if target_resolution <> 'ignored' then
    raise exception using errcode = '22023', message = 'Select a valid Instagram draft resolution.';
  end if;

  update public.instagram_product_drafts as draft
  set status = 'ignored', reviewed_by = (select auth.uid()), resolved_at = now()
  where draft.business_id = target_business_id and draft.id = target_draft_id
    and draft.status not in ('catalogue_draft', 'published', 'attached', 'ignored');
  if not found then
    raise exception using errcode = 'P0002', message = 'This Instagram draft is no longer available.';
  end if;
  return 'ignored';
end;
$$;

revoke all on function public.create_instagram_oauth_state(uuid, text, text, timestamptz)
  from public, anon;
revoke all on function public.consume_instagram_oauth_state(text)
  from public, anon;
revoke all on function public.complete_instagram_connection(uuid, uuid, jsonb, text, text, integer, timestamptz)
  from public, anon, authenticated;
revoke all on function public.set_instagram_connection_preferences(uuid, boolean)
  from public, anon;
revoke all on function public.disconnect_instagram_connection(uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.save_instagram_product_draft(uuid, uuid, jsonb)
  from public, anon;
revoke all on function public.approve_instagram_product_draft(uuid, uuid, text, boolean)
  from public, anon;
revoke all on function public.attach_instagram_draft_to_product(uuid, uuid, uuid)
  from public, anon;
revoke all on function public.resolve_instagram_product_draft(uuid, uuid, text)
  from public, anon;

grant execute on function public.create_instagram_oauth_state(uuid, text, text, timestamptz)
  to authenticated;
grant execute on function public.consume_instagram_oauth_state(text)
  to authenticated;
grant execute on function public.set_instagram_connection_preferences(uuid, boolean)
  to authenticated;
grant execute on function public.save_instagram_product_draft(uuid, uuid, jsonb)
  to authenticated;
grant execute on function public.approve_instagram_product_draft(uuid, uuid, text, boolean)
  to authenticated;
grant execute on function public.attach_instagram_draft_to_product(uuid, uuid, uuid)
  to authenticated;
grant execute on function public.resolve_instagram_product_draft(uuid, uuid, text)
  to authenticated;

revoke all on function public.get_instagram_connection_credential(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.replace_instagram_connection_credential(uuid, integer, text, text, integer, timestamptz)
  from public, anon, authenticated;
revoke all on function public.start_instagram_sync_run(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.ingest_instagram_media(uuid, uuid, integer, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_instagram_connection(uuid, uuid, jsonb, text, text, integer, timestamptz)
  to service_role;
grant execute on function public.disconnect_instagram_connection(uuid, uuid, integer)
  to service_role;
grant execute on function public.get_instagram_connection_credential(uuid, integer)
  to service_role;
grant execute on function public.replace_instagram_connection_credential(uuid, integer, text, text, integer, timestamptz)
  to service_role;
grant execute on function public.start_instagram_sync_run(uuid, uuid, uuid)
  to service_role;
grant execute on function public.ingest_instagram_media(uuid, uuid, integer, jsonb, jsonb, jsonb)
  to service_role;

notify pgrst, 'reload schema';
