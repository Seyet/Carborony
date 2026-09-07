-- Owner-only payout setup. Account numbers are sent to Paystack, not stored here.
create table public.business_payment_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null default 'paystack' check (provider = 'paystack'),
  provider_mode text not null check (provider_mode in ('test', 'live')),
  status text not null default 'creating'
    check (status in ('creating', 'connected', 'reconciliation_required')),
  operation_id uuid not null unique,
  subaccount_code text unique,
  bank_code text not null check (bank_code ~ '^[0-9]{3,12}$'),
  bank_name text not null check (char_length(bank_name) between 1 and 200),
  account_name text not null check (char_length(account_name) between 1 and 200),
  account_last_four text not null check (account_last_four ~ '^[0-9]{4}$'),
  commission_percent numeric(5,2) not null check (commission_percent between 0 and 100),
  provider_active boolean not null default false,
  provider_verified boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_payment_accounts_business_mode_key unique (business_id, provider, provider_mode),
  constraint business_payment_accounts_connection_shape check (
    (status = 'connected' and subaccount_code is not null and subaccount_code ~ '^ACCT_[A-Za-z0-9]+$')
    or (status <> 'connected' and subaccount_code is null)
  )
);

alter table public.business_payment_accounts enable row level security;
revoke all on public.business_payment_accounts from public, anon, authenticated;
grant select on public.business_payment_accounts to authenticated;
grant select, insert, update, delete on public.business_payment_accounts to service_role;

create policy business_payment_accounts_owner_read
on public.business_payment_accounts for select to authenticated
using (exists (
  select 1 from public.businesses as business
  where business.id = business_payment_accounts.business_id
    and business.created_by = (select auth.uid())
));

create trigger business_payment_accounts_set_updated_at
before update on public.business_payment_accounts
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
