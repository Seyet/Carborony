-- One revenue source for dashboard cards, charts, products and exports.
-- Keep existing stock/customer/order/expense metrics; add paid order revenue
-- without counting orders already represented in the sales ledger twice.
create function public.dashboard_revenue_documents(target_business_id uuid, range_start date, range_end date)
returns table(document_id uuid, source text, document_number text, occurred_at timestamptz,
  channel text, customer_name text, total_amount numeric, status text)
language plpgsql stable security definer set search_path = '' as $$
declare business_timezone text;
begin
  if not public.has_business_permission(target_business_id, 'dashboard.view') then
    raise exception using errcode = '42501', message = 'Dashboard access required.';
  end if;
  if range_start is null or range_end is null or range_start > range_end then
    raise exception using errcode = '22023', message = 'Invalid dashboard date range.';
  end if;
  select b.timezone into strict business_timezone from public.businesses b where b.id = target_business_id;
  return query
  select s.id, 'sale'::text, s.sale_number::text, s.sold_at, s.channel::text,
    coalesce(s.buyer_name, c.full_name, 'Walk-in customer')::text, s.total_amount::numeric, s.status::text
  from public.sales s
  left join public.customers c on c.id = s.customer_id and c.business_id = s.business_id
  where s.business_id = target_business_id
    and s.sold_at >= range_start::timestamp at time zone business_timezone
    and s.sold_at < (range_end + 1)::timestamp at time zone business_timezone
  union all
  select o.id, 'order'::text, o.order_number::text, coalesce(p.paid_at, o.completed_at, o.placed_at),
    o.channel::text, coalesce(o.buyer_name, c.full_name, 'Storefront customer')::text,
    o.total_amount::numeric, 'completed'::text
  from public.orders o
  left join public.customers c on c.id = o.customer_id and c.business_id = o.business_id
  left join public.storefront_payments p on p.order_id = o.id and p.business_id = o.business_id
  where o.business_id = target_business_id and o.document_type = 'order'
    and o.payment_status = 'paid' and o.status not in ('cancelled', 'refunded')
    and (p.order_id is null or p.status = 'paid')
    and coalesce(p.paid_at, o.completed_at, o.placed_at) >= range_start::timestamp at time zone business_timezone
    and coalesce(p.paid_at, o.completed_at, o.placed_at) < (range_end + 1)::timestamp at time zone business_timezone
    and not exists (select 1 from public.sales linked
      where linked.business_id = o.business_id and linked.order_id = o.id
        and linked.status in ('completed', 'refunded'));
end;
$$;

create function public.dashboard_revenue_items(target_business_id uuid, range_start date, range_end date)
returns table(product_id uuid, product_name text, quantity numeric, revenue numeric, cost numeric)
language sql stable security definer set search_path = '' as $$
  with documents as (
    select * from public.dashboard_revenue_documents(target_business_id, range_start, range_end)
    where status = 'completed'
  )
  select i.product_id, i.product_name::text, i.quantity::numeric, i.line_total::numeric,
    (i.quantity * i.unit_cost)::numeric
  from documents d join public.sale_items i on d.source = 'sale' and i.sale_id = d.document_id
    and i.business_id = target_business_id
  union all
  select i.product_id, i.product_name::text, i.quantity::numeric, i.line_total::numeric,
    (i.quantity * coalesce(snapshot.unit_cost, v.cost_price, p.cost_price, 0))::numeric
  from documents d join public.order_items i on d.source = 'order' and i.order_id = d.document_id
    and i.business_id = target_business_id
  left join public.products p on p.id = i.product_id and p.business_id = i.business_id
  left join public.product_variants v on v.id = i.variant_id and v.business_id = i.business_id
  left join lateral (
    select sum(-m.quantity_delta * m.unit_cost) / nullif(sum(-m.quantity_delta), 0) as unit_cost
    from public.inventory_movements m
    where m.business_id = i.business_id and m.reference_id = i.order_id
      and m.product_id = i.product_id and m.variant_id is not distinct from i.variant_id
      and m.movement_type = 'sale' and m.quantity_delta < 0
  ) snapshot on true;
$$;

create function public.get_dashboard_metrics_all_channels(target_business_id uuid, range_start date, range_end date)
returns table(customers_count bigint, expenses_total numeric, low_stock_count bigint,
  orders_count bigint, out_of_stock_count bigint, pending_orders_count bigint,
  products_count bigint, profit_total numeric, sales_total numeric)
language sql stable security definer set search_path = '' as $$
  with documents as (
    select * from public.dashboard_revenue_documents(target_business_id, range_start, range_end)
  ), totals as (
    select coalesce(sum(d.total_amount) filter (where d.status = 'completed'), 0) as revenue from documents d
  ), costs as (
    select coalesce(sum(i.cost), 0) as cost from public.dashboard_revenue_items(target_business_id, range_start, range_end) i
  )
  select base.customers_count::bigint, base.expenses_total::numeric, base.low_stock_count::bigint,
    base.orders_count::bigint, base.out_of_stock_count::bigint, base.pending_orders_count::bigint,
    base.products_count::bigint, (totals.revenue - costs.cost - base.expenses_total)::numeric, totals.revenue::numeric
  from public.get_dashboard_metrics(target_business_id => target_business_id, range_start => range_start, range_end => range_end) base
  cross join totals cross join costs;
$$;

create function public.get_dashboard_sales_overview_all_channels(target_business_id uuid, range_start date, range_end date)
returns table(period_date date, sales_total numeric, transaction_count bigint)
language sql stable security definer set search_path = '' as $$
  with documents as (
    select * from public.dashboard_revenue_documents(target_business_id, range_start, range_end)
    where status = 'completed'
  )
  select day::date, coalesce(sum(d.total_amount), 0)::numeric, count(d.document_id)
  from generate_series(range_start::timestamp, range_end::timestamp, interval '1 day') day
  cross join public.businesses b
  left join documents d on (d.occurred_at at time zone b.timezone)::date = day::date
  where b.id = target_business_id
  group by day order by day;
$$;

create function public.get_dashboard_top_products_all_channels(target_business_id uuid, range_start date, range_end date, result_limit integer default 5)
returns table(category_name text, product_id uuid, product_name text, revenue numeric, units_sold numeric)
language sql stable security definer set search_path = '' as $$
  select c.name::text, i.product_id, i.product_name, sum(i.revenue)::numeric, sum(i.quantity)::numeric
  from public.dashboard_revenue_items(target_business_id, range_start, range_end) i
  left join public.products p on p.id = i.product_id and p.business_id = target_business_id
  left join public.categories c on c.id = p.category_id and c.business_id = target_business_id
  group by c.name, i.product_id, i.product_name
  order by sum(i.revenue) desc, i.product_name, i.product_id
  limit greatest(1, least(coalesce(result_limit, 5), 100));
$$;

create function public.get_dashboard_recent_transactions_all_channels(target_business_id uuid, range_start date, range_end date, result_limit integer default 10)
returns table(channel text, customer_name text, sale_id uuid, sale_number text, sold_at timestamptz, status text, total_amount numeric)
language sql stable security definer set search_path = '' as $$
  select d.channel, d.customer_name, d.document_id, d.document_number, d.occurred_at, d.status, d.total_amount
  from public.dashboard_revenue_documents(target_business_id, range_start, range_end) d
  order by d.occurred_at desc, d.document_id
  limit greatest(1, least(coalesce(result_limit, 10), 100));
$$;

revoke all on function public.dashboard_revenue_documents(uuid,date,date), public.dashboard_revenue_items(uuid,date,date),
  public.get_dashboard_metrics_all_channels(uuid,date,date), public.get_dashboard_sales_overview_all_channels(uuid,date,date),
  public.get_dashboard_top_products_all_channels(uuid,date,date,integer), public.get_dashboard_recent_transactions_all_channels(uuid,date,date,integer)
  from public, anon;
grant execute on function public.get_dashboard_metrics_all_channels(uuid,date,date), public.get_dashboard_sales_overview_all_channels(uuid,date,date),
  public.get_dashboard_top_products_all_channels(uuid,date,date,integer), public.get_dashboard_recent_transactions_all_channels(uuid,date,date,integer)
  to authenticated;
