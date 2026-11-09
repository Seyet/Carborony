import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"

test("dashboard unifies POS and paid storefront revenue without duplicates across cards, charts, products and transactions", async () => {
  const db = new PGlite()
  const owner = '00000000-0000-4000-8000-000000000001'
  const business = '00000000-0000-4000-8000-000000000002'
  const product = '00000000-0000-4000-8000-000000000003'
  const id = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`
  try {
    await db.exec(readFileSync('tests/fixtures/online-payments.sql','utf8'))
    await db.exec(`
      alter table businesses add column timezone text default 'Africa/Lagos';
      alter table products add column category_id uuid;
      create table categories(id uuid, business_id uuid, name text);
      alter table sales add column id uuid default gen_random_uuid(), add column sale_number text,
        add column sold_at timestamptz, add column channel text, add column buyer_name text,
        add column customer_id uuid, add column total_amount numeric;
      alter table sale_items add column business_id uuid, add column sale_id uuid, add column product_id uuid,
        add column product_name text, add column line_total numeric, add column unit_cost numeric;
      alter table order_items add column line_total numeric;
      create table storefront_payments(business_id uuid, order_id uuid unique, paid_at timestamptz, status text);
      create function get_dashboard_metrics(target_business_id uuid,range_start date,range_end date)
      returns table(customers_count bigint, expenses_total numeric, low_stock_count bigint,
        orders_count bigint, out_of_stock_count bigint, pending_orders_count bigint,
        products_count bigint, profit_total numeric, sales_total numeric)
      language sql as $$ select 4::bigint, 10::numeric, 2::bigint, 7::bigint, 1::bigint, 3::bigint, 8::bigint, 0::numeric, 100::numeric $$;
    `)
    await db.exec(readFileSync('supabase/migrations/20261109000000_dashboard_all_sales_channels.sql','utf8'))
    await db.query('insert into profiles values ($1)',[owner])
    await db.query("insert into businesses(id,slug,created_by) values ($1,'shop',$2)",[business,owner])
    await db.query("insert into products(id,business_id,name,cost_price) values ($1,$2,'Shirt',20)",[product,business])
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner])
    // Paid pending order, linked order, unpaid, refunded, cancelled, review,
    // previous-period order and a manually confirmed transfer.
    for (const [n,payment,status,ledger,date] of [
      [1,'paid','pending','paid','2026-11-09T10:00:00Z'],
      [2,'paid','completed',null,'2026-11-09T10:00:00Z'],
      [3,'unpaid','pending',null,'2026-11-09T10:00:00Z'],
      [4,'paid','refunded',null,'2026-11-09T10:00:00Z'],
      [5,'paid','cancelled',null,'2026-11-09T10:00:00Z'],
      [6,'paid','pending','review','2026-11-09T10:00:00Z'],
      [7,'paid','pending','paid','2026-11-08T22:30:00Z'],
      [8,'paid','completed',null,'2026-11-09T11:00:00Z'],
    ]) {
      await db.query(`insert into orders(id,business_id,document_type,order_number,channel,status,payment_status,total_amount,placed_at)
        values ($1,$2,'order',$3,'storefront',$4,$5,200,$6)`,[id(n),business,`ORD-${n}`,status,payment,date])
      await db.query(`insert into order_items(business_id,order_id,product_id,product_name,quantity,line_total)
        values ($1,$2,$3,'Shirt',2,200)`,[business,id(n),product])
      if (ledger) await db.query('insert into storefront_payments values ($1,$2,$3,$4)',[business,id(n),date,ledger])
    }
    // POS sale linked to order 2 must count once, regardless of order date.
    await db.query(`insert into sales(id,business_id,order_id,status,sale_number,sold_at,channel,total_amount)
      values ($1,$2,$3,'completed','SALE-1','2026-11-09T09:00:00Z','pos',100)`,[id(20),business,id(2)])
    await db.query("insert into sale_items(business_id,sale_id,product_id,product_name,quantity,line_total,unit_cost) values ($1,$2,$3,'Shirt',1,100,15)",[business,id(20),product])
    const args = [business,'2026-11-09','2026-11-09']
    const metric = (await db.query('select * from get_dashboard_metrics_all_channels($1,$2,$3)',args)).rows[0]
    assert.equal(Number(metric.sales_total),500)
    assert.equal(Number(metric.profit_total),395) // 500 - POS 15 - orders 80 - expenses 10
    assert.equal(Number(metric.orders_count),7)
    assert.equal(Number(metric.low_stock_count),2)
    const chart = (await db.query('select * from get_dashboard_sales_overview_all_channels($1,$2,$3)',args)).rows
    assert.equal(chart.length,1)
    assert.equal(Number(chart[0].sales_total),500)
    assert.equal(Number(chart[0].transaction_count),3)
    const products = (await db.query('select * from get_dashboard_top_products_all_channels($1,$2,$3)',args)).rows
    assert.equal(Number(products[0].revenue),500)
    assert.equal(Number(products[0].units_sold),5)
    const transactions = (await db.query('select * from get_dashboard_recent_transactions_all_channels($1,$2,$3)',args)).rows
    assert.deepEqual(new Set(transactions.map(t=>t.sale_number)),new Set(['SALE-1','ORD-1','ORD-8']))
    const previous = (await db.query('select * from get_dashboard_metrics_all_channels($1,$2,$3)',[business,'2026-11-08','2026-11-08'])).rows[0]
    assert.equal(Number(previous.sales_total),200) // Lagos calendar boundary
    // Inventory consumption preserves historical costs even after catalogue changes.
    await db.query(`insert into inventory_movements(business_id,product_id,movement_type,quantity_delta,unit_cost,reference_type,reference_id,created_by)
      values ($1,$2,'sale',-2,12,'order',$3,$4)`,[business,product,id(1),owner])
    const snapshotMetric = (await db.query('select * from get_dashboard_metrics_all_channels($1,$2,$3)',args)).rows[0]
    assert.equal(Number(snapshotMetric.profit_total),411)
    const otherBusiness = id(90)
    await db.query("insert into businesses(id,slug,created_by) values ($1,'other',$2)",[otherBusiness,owner])
    await db.query(`insert into sales(business_id,status,total_amount,sold_at) values ($1,'completed',9000,'2026-11-09T12:00:00Z')`,[otherBusiness])
    assert.equal(Number((await db.query('select * from get_dashboard_metrics_all_channels($1,$2,$3)',args)).rows[0].sales_total),500)
    await db.query("select set_config('request.jwt.claim.sub','',false)")
    await assert.rejects(db.query('select * from get_dashboard_recent_transactions_all_channels($1,$2,$3)',args),/Dashboard access required/)
    await db.exec('set role anon')
    await assert.rejects(db.query('select * from get_dashboard_metrics_all_channels($1,$2,$3)',args),/permission denied/)
  } finally { await db.close() }
})
