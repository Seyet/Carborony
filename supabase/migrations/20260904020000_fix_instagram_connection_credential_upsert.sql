-- Resolve the PL/pgSQL output-column collision in the credential upsert.

create or replace function public.complete_instagram_connection(
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
  on conflict on constraint instagram_credentials_pkey do update set
    encrypted_access_token = excluded.encrypted_access_token,
    token_fingerprint = excluded.token_fingerprint,
    encryption_version = excluded.encryption_version,
    token_expires_at = excluded.token_expires_at,
    refreshed_at = now();

  return query select saved_connection_id, normalized_username, 'connected'::text;
end;
$$;

revoke all on function public.complete_instagram_connection(
  uuid, uuid, jsonb, text, text, integer, timestamptz
) from public, anon, authenticated;

grant execute on function public.complete_instagram_connection(
  uuid, uuid, jsonb, text, text, integer, timestamptz
) to service_role;

notify pgrst, 'reload schema';
