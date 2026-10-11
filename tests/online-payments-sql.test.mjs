import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { test } from "node:test"

const read = path => readFileSync(path, "utf8")
const migration = name => read(`supabase/migrations/${name}.sql`)
function functionsOnly(sql, name) {
  const starts = [
    sql.indexOf(`create function public.${name}(`),
    sql.indexOf(`create or replace function public.${name}(`),
  ].filter(index => index >= 0)
  assert.ok(starts.length > 0, `Function ${name} was not found in the migration`)
  const start = Math.min(...starts)
  return sql.slice(start, sql.indexOf("\n$$;", start) + 4)
}

test("PostgreSQL online checkout, settlement, inventory and access controls", async () => {
  const db = new PGlite()
  try {
    await db.exec(read("tests/fixtures/online-payments.sql"))
    await db.exec(functionsOnly(migration("20260823070000_external_pos_items_and_invoices"), "normalize_pos_items"))
    await db.exec(migration("20260823153000_fix_negative_inventory_movements"))
    await db.exec("create trigger inventory_apply after insert on public.inventory_movements for each row execute function public.apply_inventory_movement()")
    const inventory = migration("20260824000000_paid_invoice_inventory")
    const completedOrderInventory = migration("20260823164000_completed_order_inventory")
    await db.exec(functionsOnly(inventory, "consume_order_document_inventory"))
    await db.exec(functionsOnly(inventory, "consume_completed_order_inventory"))
    await db.exec(functionsOnly(completedOrderInventory, "apply_completed_order_inventory"))
    await db.exec("create trigger orders_apply_completed_inventory after update of status on public.orders for each row execute function public.apply_completed_order_inventory()")
    await db.exec(migration("20260906010000_business_payment_setup"))
    await db.exec(migration("20260906020000_storefront_online_payments"))
    await db.exec(migration("20260906030000_harden_storefront_online_payments"))
    await db.exec(migration("20260906040000_fix_storefront_payment_inventory_settlement"))
    await db.exec(migration("20260906050000_require_whole_number_stock"))
    await db.exec(migration("20260906070000_normalize_whole_number_stock"))
    await db.exec(migration("20260906080000_reconcile_reviewed_order_payments"))
    const owner = "00000000-0000-4000-8000-000000000001", business = "00000000-0000-4000-8000-000000000002", product = "00000000-0000-4000-8000-000000000003", location = "00000000-0000-4000-8000-000000000004"
    await db.query("insert into profiles values ($1)", [owner])
    await db.query("insert into businesses(id,slug,created_by) values ($1,'shop',$2)", [business, owner])
    await db.query("insert into storefronts(business_id) values($1)", [business])
    await db.query("insert into products(id,business_id,name,selling_price) values($1,$2,'Product',2500.25)", [product, business])
    await db.query("insert into storefront_products(business_id,product_id) values($1,$2)", [business, product])
    await db.query("insert into inventory_locations(id,business_id) values($1,$2)", [location, business])
    await db.query("insert into inventory_levels(business_id,product_id,location_id,quantity_on_hand) values($1,$2,$3,5)", [business, product, location])
    await db.query("insert into business_payment_accounts(business_id,provider_mode,status,operation_id,subaccount_code,bank_code,bank_name,account_name,account_last_four,commission_percent,provider_active,created_by) values($1,'test','connected',gen_random_uuid(),'ACCT_test','058','Bank','Owner','1234',0,true,$2)", [business, owner])
    const args = ["shop", JSON.stringify([{ product_id: product, quantity: 2 }]), "Test Buyer", "buyer@example.com", "08012345678", "", "pickup", null, "online", "", "00000000-0000-4000-8000-000000000005", "test", "a".repeat(64)]
    const create = async values => (await db.query("select * from create_storefront_online_order($1,$2::jsonb,$3,$4,$5,$6,$7,$8::uuid,$9,$10,$11::uuid,$12,$13)", values)).rows[0]
    const first = await create(args)
    assert.equal(Number(first.amount_minor), 500050)
    assert.equal(first.subaccount_code, "ACCT_test")
    assert.equal((await db.query("select payment_method from orders where id=$1", [first.order_id])).rows[0].payment_method, "online")
    assert.equal((await create(args)).reference, first.reference)
    await assert.rejects(create([...args.slice(0, 12), "b".repeat(64)]), /already in use/)
    const fractional = [...args]
    fractional[1] = JSON.stringify([{ product_id: product, quantity: 1.5 }])
    fractional[10] = "00000000-0000-4000-8000-000000000009"
    fractional[12] = "c".repeat(64)
    await assert.rejects(create(fractional), /order_items_quantity_whole/)
    await assert.rejects(db.query("update orders set payment_status='paid' where id=$1", [first.order_id]), /must be verified/)
    await assert.rejects(db.query("update orders set status='confirmed' where id=$1", [first.order_id]), /Verify the online payment/)
    await assert.rejects(db.query("update order_items set quantity=10 where order_id=$1", [first.order_id]), /cannot be changed/)
    const settle = (payment, amount = 500050, id = "1001") => db.query("select settle_storefront_payment($1,$2,'NGN','test',$3) as status", [payment.reference, amount, id])
    await assert.rejects(settle(first, 100), /mismatch/)
    assert.equal((await settle(first)).rows[0].status, "paid")
    assert.equal((await settle(first)).rows[0].status, "paid")
    await db.query("update orders set status='completed' where id=$1", [first.order_id])
    assert.equal(Number((await db.query("select quantity_on_hand from inventory_levels")).rows[0].quantity_on_hand), 3)
    assert.equal((await db.query("select count(*)::int as count from inventory_movements")).rows[0].count, 1)
    await assert.rejects(db.query("update orders set payment_status='refunded' where id=$1", [first.order_id]), /must be verified/)

    // Stock can sell out after initialization. Record money received without pretending fulfilment is possible.
    args[10] = "00000000-0000-4000-8000-000000000006"
    const second = await create(args)
    await db.exec("update inventory_levels set quantity_on_hand=0")
    assert.equal((await settle(second, 500050, "1002")).rows[0].status, "review")
    assert.equal((await db.query("select payment_status from orders where id=$1", [second.order_id])).rows[0].payment_status, "paid")
    await assert.rejects(db.query("update orders set status='completed' where id=$1", [second.order_id]), /needs payment review/)
    assert.equal((await db.query("select count(*)::int as count from inventory_movements")).rows[0].count, 1)

    // Anonymous and unrelated users cannot advance a paid order under review.
    await assert.rejects(db.query("select * from update_order_status($1,$2,'confirmed')", [business, second.order_id]), /permission/)
    await db.exec("select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000099', false)")
    await assert.rejects(db.query("select * from update_order_status($1,$2,'confirmed')", [business, second.order_id]), /permission/)
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner])
    await assert.rejects(db.query("select * from update_order_status($1,$2,'confirmed')", [business, second.order_id]), /inventory review/)
    await db.exec("update inventory_levels set quantity_on_hand=5")
    // The merchant status transition retries the verified payment after stock is repaired.
    const advanced = await db.query("select * from update_order_status($1,$2,'confirmed')", [business, second.order_id])
    assert.equal(advanced.rows[0].current_status, "confirmed")
    assert.equal((await settle(second, 500050, "1002")).rows[0].status, "paid")
    assert.equal(Number((await db.query("select quantity_on_hand from inventory_levels")).rows[0].quantity_on_hand), 3)
    assert.equal((await db.query("select count(*)::int as count from inventory_movements")).rows[0].count, 2)
    args[10] = "00000000-0000-4000-8000-000000000007"
    const cancelled = await create(args)
    await db.query("update orders set status='cancelled' where id=$1", [cancelled.order_id])
    assert.equal((await settle(cancelled, 500050, "1003")).rows[0].status, "review")
    assert.equal(Number((await db.query("select quantity_on_hand from inventory_levels")).rows[0].quantity_on_hand), 3)
    args[10] = "00000000-0000-4000-8000-000000000008"
    args[11] = "live"
    await assert.rejects(create(args), /Online payment is unavailable/)
    args[11] = "test"
    await db.exec("update business_payment_accounts set provider_active=false")
    await assert.rejects(create(args), /Online payment is unavailable/)

    // Anonymous clients cannot read the ledger or invoke either privileged RPC.
    await db.exec("set role anon")
    await assert.rejects(db.exec("select * from storefront_payments"), /permission denied/)
    await assert.rejects(create(args), /permission denied/)
    await assert.rejects(settle(first), /permission denied/)
    await db.exec("reset role")
    await db.exec("set role authenticated")
    await assert.rejects(db.exec("select * from storefront_payments"), /permission denied/)
    await assert.rejects(settle(first), /permission denied/)
    await db.exec("reset role")
  } finally { await db.close() }
})
