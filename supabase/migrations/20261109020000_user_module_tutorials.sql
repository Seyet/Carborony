begin;
create table public.user_tutorial_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  automatic boolean not null default true
);
create table public.user_module_tutorials (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null check (module_id in (
    'dashboard','sales','sales-history','catalogue','orders','inventory','customers',
    'expenses','reports','activity','website','instagram','staff','settings'
  )),
  status text not null check (status in ('completed','skipped')),
  primary key (user_id,module_id)
);
alter table public.user_tutorial_preferences enable row level security;
alter table public.user_module_tutorials enable row level security;
revoke all on public.user_tutorial_preferences,public.user_module_tutorials from public,anon,authenticated;
grant select,insert,update on public.user_tutorial_preferences,public.user_module_tutorials to authenticated;
create policy tutorial_preferences_own_select on public.user_tutorial_preferences for select to authenticated using (user_id=(select auth.uid()));
create policy tutorial_preferences_own_insert on public.user_tutorial_preferences for insert to authenticated with check (user_id=(select auth.uid()));
create policy tutorial_preferences_own_update on public.user_tutorial_preferences for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy module_tutorials_own_select on public.user_module_tutorials for select to authenticated using (user_id=(select auth.uid()));
create policy module_tutorials_own_insert on public.user_module_tutorials for insert to authenticated with check (user_id=(select auth.uid()));
create policy module_tutorials_own_update on public.user_module_tutorials for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
-- Existing users can replay guides manually. Accounts created after this
-- migration automatically receive first-visit guides without an auth trigger.
insert into public.user_tutorial_preferences(user_id,automatic)
select id,false from auth.users on conflict (user_id) do nothing;
notify pgrst,'reload schema';
commit;
