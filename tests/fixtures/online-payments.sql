-- Minimal domain fixture; payment, normalization and inventory functions are loaded from real migrations.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create table public.profiles(id uuid primary key);
create table public.businesses(id uuid primary key, slug text unique, created_by uuid references profiles(id), country_code text default 'NG', currency_code text default 'NGN');
create table public.storefronts(business_id uuid primary key, status text default 'published', delivery_enabled boolean default true, pickup_enabled boolean default true, pay_on_delivery_enabled boolean default false, bank_transfer_enabled boolean default false, bank_transfer_instructions text);
create table public.storefront_delivery_zones(id uuid primary key, business_id uuid, name text, delivery_fee numeric, is_active boolean default true);
create table public.products(id uuid primary key, business_id uuid, name text, sku text, selling_price numeric, discount_price numeric, cost_price numeric default 0, reorder_level numeric default 0, track_inventory boolean default true, status text default 'active', unique(business_id,id));
create table public.product_variants(id uuid primary key, business_id uuid, product_id uuid, name text, sku text, selling_price numeric, cost_price numeric default 0, stock_quantity numeric default 5, low_stock_threshold numeric default 0, is_active boolean default true);
create table public.storefront_products(business_id uuid, product_id uuid, is_visible boolean default true);
create table public.inventory_locations(id uuid primary key default gen_random_uuid(), business_id uuid, is_default boolean default true, is_active boolean default true, created_at timestamptz default now());
create table public.inventory_levels(id uuid primary key default gen_random_uuid(), business_id uuid, product_id uuid, location_id uuid, quantity_on_hand numeric not null check(quantity_on_hand >= 0), quantity_reserved numeric default 0, updated_at timestamptz, unique(business_id,product_id,location_id));
create table public.inventory_movements(id uuid default gen_random_uuid(), business_id uuid, product_id uuid, variant_id uuid, location_id uuid, movement_type text, quantity_delta numeric, unit_cost numeric, reference_type text, reference_id uuid, note text, created_by uuid not null references profiles(id));
create table public.customers(id uuid primary key default gen_random_uuid(), business_id uuid, full_name text, email text, phone text, address text, source text, created_by uuid, created_at timestamptz default now());
create table public.orders(id uuid primary key, business_id uuid, customer_id uuid, buyer_name text, buyer_email text, buyer_phone text, delivery_address text, delivery_zone_id uuid, delivery_zone_name text, order_number text, document_type text, channel text, status text, payment_status text, payment_method text, fulfillment_status text, currency_code text, subtotal_amount numeric, discount_amount numeric, tax_amount numeric, shipping_amount numeric, total_amount numeric, notes text, placed_at timestamptz, created_by uuid, unique(business_id,id));
create table public.order_items(business_id uuid, order_id uuid references orders(id), item_source text, product_id uuid, variant_id uuid, product_name text, variant_name text, sku text, quantity numeric, unit_price numeric, discount_amount numeric);
create table public.order_status_history(business_id uuid, order_id uuid, previous_status text, new_status text, note text, changed_by uuid);
create table public.storefront_checkouts(business_id uuid, idempotency_key uuid, order_id uuid, unique(business_id,idempotency_key));
create table public.sales(business_id uuid, order_id uuid, status text);
create table public.sale_items(quantity numeric);

-- Authorization boundary fixtures used by the real reconciliation RPC.
alter table public.orders add column completed_at timestamptz;
create function public.is_business_member(target_business_id uuid) returns boolean language sql as $$
  select exists(select 1 from public.businesses where id = target_business_id and created_by = auth.uid())
$$;
create function public.has_business_permission(target_business_id uuid, permission_code text) returns boolean language sql as $$
  select public.is_business_member(target_business_id)
$$;
