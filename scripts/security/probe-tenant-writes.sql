-- Run in Supabase SQL Editor on a TEST PROJECT using dedicated existing fixtures.
-- Replace every REPLACE_* value first. An error aborts the transaction; ROLLBACK
-- restores all writes, including writes that incorrectly passed isolation.
begin;
select set_config('audit.actor_a','REPLACE_OWNER_A_UUID',true);
select set_config('audit.business_a','REPLACE_BUSINESS_A_UUID',true);
select set_config('audit.business_b','REPLACE_BUSINESS_B_UUID',true);
select set_config('audit.order_a','REPLACE_ORDER_A_UUID',true);
select set_config('audit.order_b','REPLACE_ORDER_B_UUID',true);
select set_config('audit.customer_a','REPLACE_CUSTOMER_A_UUID',true);
select set_config('audit.customer_b','REPLACE_CUSTOMER_B_UUID',true);
select set_config('audit.private_file_b','REPLACE_PRIVATE_EXPENSE_ATTACHMENT_PATH_B',true);

-- Confirm fixtures exist as administrator before impersonation. Otherwise zero
-- affected rows could hide a broken policy or an incorrect test identifier.
do $$
begin
  if current_setting('audit.business_a')=current_setting('audit.business_b') then
    raise exception 'Different businesses required';
  end if;
  if not exists(select 1 from public.businesses where id=current_setting('audit.business_a')::uuid and created_by=current_setting('audit.actor_a')::uuid)
    or not exists(select 1 from public.orders where id=current_setting('audit.order_a')::uuid and business_id=current_setting('audit.business_a')::uuid)
    or not exists(select 1 from public.orders where id=current_setting('audit.order_b')::uuid and business_id=current_setting('audit.business_b')::uuid)
    or not exists(select 1 from public.customers where id=current_setting('audit.customer_a')::uuid and business_id=current_setting('audit.business_a')::uuid)
    or not exists(select 1 from public.customers where id=current_setting('audit.customer_b')::uuid and business_id=current_setting('audit.business_b')::uuid)
    or not exists(select 1 from storage.objects where bucket_id='expense-attachments' and name=current_setting('audit.private_file_b'))
    or not exists(select 1 from public.business_payment_accounts where business_id=current_setting('audit.business_b')::uuid) then
    raise exception 'Missing or mismatched dedicated fixture';
  end if;
  if exists(select 1 from public.business_members where business_id=current_setting('audit.business_b')::uuid and user_id=current_setting('audit.actor_a')::uuid) then
    raise exception 'Actor A must not be a member of business B';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub',current_setting('audit.actor_a'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('audit.actor_a'),'role','authenticated','aal','aal1')::text,true);
set local role authenticated;
do $$
declare affected bigint;
begin
  if not exists(select 1 from public.orders where id=current_setting('audit.order_a')::uuid)
    or not exists(select 1 from public.customers where id=current_setting('audit.customer_a')::uuid) then
    raise exception 'Own-tenant positive control failed';
  end if;
  if exists(select 1 from public.orders where id=current_setting('audit.order_b')::uuid)
    or exists(select 1 from public.customers where id=current_setting('audit.customer_b')::uuid) then
    raise exception 'Foreign tenant rows are readable';
  end if;

  update public.orders set notes=notes where id=current_setting('audit.order_a')::uuid;
  get diagnostics affected = row_count;
  if affected<>1 then raise exception 'Own order write positive control failed'; end if;
  update public.customers set notes=notes where id=current_setting('audit.customer_a')::uuid;
  get diagnostics affected = row_count;
  if affected<>1 then raise exception 'Own customer write positive control failed'; end if;

  begin
    update public.orders set customer_id=current_setting('audit.customer_b')::uuid where id=current_setting('audit.order_a')::uuid;
    get diagnostics affected = row_count;
    if affected<>0 then raise exception 'Foreign customer reference allowed on own order'; end if;
  exception when insufficient_privilege or foreign_key_violation or check_violation then null; end;
  begin
    update public.orders set notes=notes where id=current_setting('audit.order_b')::uuid;
    get diagnostics affected = row_count;
    if affected<>0 then raise exception 'Foreign order UPDATE allowed'; end if;
  exception when insufficient_privilege then null; end;
  begin
    update public.customers set notes=notes where id=current_setting('audit.customer_b')::uuid;
    get diagnostics affected = row_count;
    if affected<>0 then raise exception 'Foreign customer UPDATE allowed'; end if;
  exception when insufficient_privilege then null; end;
  begin
    update public.customers set business_id=current_setting('audit.business_b')::uuid where id=current_setting('audit.customer_a')::uuid;
    get diagnostics affected = row_count;
    if affected<>0 then raise exception 'Customer tenant reassignment allowed'; end if;
  exception when insufficient_privilege then null; end;
  begin
    update storage.objects set metadata=metadata where bucket_id='expense-attachments' and name=current_setting('audit.private_file_b');
    get diagnostics affected = row_count;
    if affected<>0 then raise exception 'Foreign private file UPDATE allowed'; end if;
  exception when insufficient_privilege then null; end;
  begin
    update public.business_payment_accounts set account_name=account_name where business_id=current_setting('audit.business_b')::uuid;
    get diagnostics affected = row_count;
    if affected<>0 then raise exception 'Foreign payout UPDATE allowed'; end if;
  exception when insufficient_privilege then null; end;
  raise notice 'Tenant write probes passed; transaction will be rolled back';
end;
$$;
reset role;
rollback;
-- Run again with A/B exchanged to verify the other direction.
