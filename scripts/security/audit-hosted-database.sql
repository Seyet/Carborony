-- Run as the database administrator in Supabase SQL Editor.
-- Read-only metadata inspection: no tenant data or secrets are selected.
begin transaction read only;

-- RLS coverage and effective table privileges. Review every exposed tenant table.
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls,
  has_table_privilege('anon',c.oid,'SELECT') as anon_select,
  has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_select,
  has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') as authenticated_write
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and n.nspname in ('public','storage','private')
order by n.nspname,c.relname;

select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','storage','private')
order by schemaname,tablename,policyname;

-- Public catalogue/logo/banner buckets intentionally permit public downloads.
-- expense-attachments must be private. Public SELECT policies do not protect downloads.
select id,public,file_size_limit,allowed_mime_types from storage.buckets order by id;

-- Include hosted-only definers; these cannot be inferred from local migrations.
select p.oid::regprocedure::text as signature, pg_get_userbyid(p.proowner) as owner,
  p.proconfig, has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute,
  exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute,
  pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where p.prosecdef and n.nspname in ('public','private')
order by n.nspname,p.proname,p.oid;

-- Differences from the reviewed execution manifest, including inherited grants.
with reviewed(signature,allowed_roles) as (values
  ('public.normalize_pos_items(uuid,jsonb)', array[]::text[]),
  ('public.complete_pos_sale(uuid,uuid,text,numeric,jsonb)', array['authenticated']::text[]),
  ('public.create_pos_invoice(uuid,uuid,numeric,jsonb)', array['authenticated']::text[]),
  ('public.apply_inventory_movement()', array[]::text[]),
  ('public.consume_completed_order_inventory(uuid,uuid,uuid)', array[]::text[]),
  ('public.apply_completed_order_inventory()', array[]::text[]),
  ('public.consume_order_document_inventory(uuid,uuid,uuid,text,text)', array[]::text[]),
  ('public.consume_paid_invoice_inventory(uuid,uuid,uuid)', array[]::text[]),
  ('public.apply_paid_invoice_inventory()', array[]::text[]),
  ('public.create_instagram_oauth_state(uuid,text,text,timestamptz)', array['authenticated']::text[]),
  ('public.consume_instagram_oauth_state(text)', array['authenticated']::text[]),
  ('public.complete_instagram_connection(uuid,uuid,jsonb,text,text,integer,timestamptz)', array['service_role']::text[]),
  ('public.get_instagram_connection_credential(uuid,integer)', array['service_role']::text[]),
  ('public.replace_instagram_connection_credential(uuid,integer,text,text,integer,timestamptz)', array['service_role']::text[]),
  ('public.start_instagram_sync_run(uuid,uuid,uuid)', array['service_role']::text[]),
  ('public.set_instagram_connection_preferences(uuid,boolean)', array['authenticated']::text[]),
  ('public.disconnect_instagram_connection(uuid,uuid,integer)', array['service_role']::text[]),
  ('public.ingest_instagram_media(uuid,uuid,integer,jsonb,jsonb,jsonb)', array['service_role']::text[]),
  ('public.save_instagram_product_draft(uuid,uuid,jsonb)', array['authenticated']::text[]),
  ('public.approve_instagram_product_draft(uuid,uuid,text,boolean)', array['authenticated']::text[]),
  ('public.attach_instagram_draft_to_product(uuid,uuid,uuid)', array['authenticated']::text[]),
  ('public.resolve_instagram_product_draft(uuid,uuid,text)', array['authenticated']::text[]),
  ('public.create_storefront_online_order(text,jsonb,text,text,text,text,text,uuid,text,text,uuid,text,text)', array['service_role']::text[]),
  ('public.settle_storefront_payment(text,bigint,text,text,text)', array['service_role']::text[]),
  ('public.guard_storefront_payment_order()', array[]::text[]),
  ('public.guard_storefront_payment_items()', array[]::text[]),
  ('public.set_online_order_payment_method()', array[]::text[]),
  ('public.update_order_status(uuid,uuid,text,text)', array['authenticated']::text[]),
  ('public.get_order_payment_state(uuid,uuid)', array['authenticated']::text[]),
  ('public.search_public_storefront_products(text,boolean,text,uuid,integer,integer)', array['anon','authenticated']::text[]),
  ('public.dashboard_revenue_documents(uuid,date,date)', array[]::text[]),
  ('public.dashboard_revenue_items(uuid,date,date)', array[]::text[]),
  ('public.get_dashboard_metrics_all_channels(uuid,date,date)', array['authenticated']::text[]),
  ('public.get_dashboard_sales_overview_all_channels(uuid,date,date)', array['authenticated']::text[]),
  ('public.get_dashboard_top_products_all_channels(uuid,date,date,integer)', array['authenticated']::text[]),
  ('public.get_dashboard_recent_transactions_all_channels(uuid,date,date,integer)', array['authenticated']::text[])
), resolved as (select *,to_regprocedure(signature) as function_oid from reviewed)
select signature,allowed_roles,function_oid is null as missing,
  case when function_oid is not null then has_function_privilege('anon',function_oid,'EXECUTE') <> ('anon'=any(allowed_roles)) end as anon_grant_mismatch,
  case when function_oid is not null then has_function_privilege('authenticated',function_oid,'EXECUTE') <> ('authenticated'=any(allowed_roles)) end as authenticated_grant_mismatch,
  case when function_oid is not null then has_function_privilege('service_role',function_oid,'EXECUTE') <> ('service_role'=any(allowed_roles)) end as service_grant_mismatch
from resolved order by signature;

-- Cross-reference FKs must preserve business scope as well as object identity.
select conrelid::regclass::text as table_name,conname,pg_get_constraintdef(oid) as definition
from pg_constraint where contype='f' and connamespace='public'::regnamespace
order by conrelid::regclass::text,conname;

-- SECURITY INVOKER views or explicit tenant authorization are needed for exposed views.
select c.oid::regclass::text as view_name,c.reloptions,pg_get_viewdef(c.oid) as definition
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='v' and n.nspname='public';
rollback;
