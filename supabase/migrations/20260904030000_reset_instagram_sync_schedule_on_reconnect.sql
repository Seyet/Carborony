-- A newly connected account must be allowed to sync immediately, even when the
-- business previously connected another account with an active cooldown.

create or replace function public.reset_instagram_sync_schedule_on_generation_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
    or new.connection_generation is distinct from old.connection_generation then
    new.last_synced_at := null;
    new.next_sync_at := null;
  end if;

  return new;
end;
$$;

revoke all on function public.reset_instagram_sync_schedule_on_generation_change()
  from public, anon, authenticated;

drop trigger if exists instagram_connections_reset_sync_schedule
  on public.instagram_connections;
create trigger instagram_connections_reset_sync_schedule
before insert or update of connection_generation on public.instagram_connections
for each row execute function public.reset_instagram_sync_schedule_on_generation_change();

-- Unblock connections that were already reconnected before this trigger existed.
update public.instagram_connections
set last_synced_at = null,
    next_sync_at = null
where status = 'connected'
  and next_sync_at > now()
  and (last_synced_at is null or connected_at > last_synced_at);

notify pgrst, 'reload schema';
