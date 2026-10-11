import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"

test("public catalogue paginates before enrichment and isolates draft and tenant data", async () => {
  const db = new PGlite()
  try {
    await db.exec(readFileSync("tests/fixtures/online-payments.sql", "utf8"))
    await db.exec(`
      alter table products add column description text, add column category_id uuid;
      alter table storefront_products add column is_featured boolean default false, add column position integer default 0;
      create table categories(id uuid primary key, business_id uuid, name text, is_active boolean default true);
      create table product_media(id uuid primary key default gen_random_uuid(), business_id uuid, product_id uuid,
        storage_path text, media_kind text default 'image', variant_id uuid, is_primary boolean default false,
        position integer default 0, created_at timestamptz default now());
    `)
    await db.exec(readFileSync("supabase/migrations/20260921090000_paginate_public_storefront.sql", "utf8"))
    const owner = "00000000-0000-4000-8000-000000000001"
    const business = "00000000-0000-4000-8000-000000000002"
    const otherBusiness = "00000000-0000-4000-8000-000000000003"
    const category = "00000000-0000-4000-8000-000000000004"
    await db.query("insert into profiles values ($1)", [owner])
    await db.query("insert into businesses(id,slug,created_by) values ($1,'shop',$3), ($2,'other-shop',$3)", [business, otherBusiness, owner])
    await db.query("insert into storefronts(business_id) values ($1),($2)", [business, otherBusiness])
    await db.query("insert into categories(id,business_id,name) values ($1,$2,'Clothing')", [category, business])
    await db.query(`insert into products(id,business_id,name,description,selling_price,category_id)
      select ('10000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
        $1, 'Product ' || lpad(i::text,3,'0'), repeat('description ',100), 100+i,
        case when i > 24 then $2::uuid else null end from generate_series(1,60) i`, [business, category])
    await db.query("insert into storefront_products(business_id,product_id) select business_id,id from products")
    await db.exec("update storefront_products set is_featured=true where product_id='10000000-0000-4000-8000-000000000060'")
    await db.query(`insert into product_media(business_id,product_id,storage_path,position)
      select $1, '10000000-0000-4000-8000-000000000060', 'photo-' || i || '.jpg', i
      from generate_series(1,10) i`, [business])
    await db.query(`insert into product_variants(id,business_id,product_id,selling_price,stock_quantity)
      values (gen_random_uuid(),$1,'10000000-0000-4000-8000-000000000060',125,0),
        (gen_random_uuid(),$1,'10000000-0000-4000-8000-000000000060',250,3)`, [business])
    const search = async ({ slug = "shop", preview = false, query = "", categoryId = null, limit = 24, offset = 0 } = {}) =>
      (await db.query("select * from search_public_storefront_products($1,$2,$3,$4,$5,$6)", [slug, preview, query, categoryId, limit, offset])).rows[0]

    const first = await search()
    assert.equal(first.products.length, 24)
    assert.equal(Number(first.total_count), 60)
    assert.equal(Number(first.featured_count), 1)
    assert.deepEqual(first.categories, [{ id: category, name: "Clothing" }])
    assert.equal(first.products[0].product_name, "Product 060")
    assert.equal(first.products[0].media.length, 1)
    assert.equal(first.products[0].description.length, 240)
    assert.deepEqual(first.products[0].variants.map(v => Number(v.selling_price)).sort((a,b) => a-b), [125,250])
    assert.equal(first.products[0].variants.some(v => v.stock_quantity > 0), true)
    const second = await search({ offset: 24 })
    const third = await search({ offset: 48 })
    assert.equal(new Set([...first.products, ...second.products, ...third.products].map(p => p.product_id)).size, 60)
    assert.equal((await search({ limit: 10000 })).products.length, 48)
    assert.equal((await search({ offset: -1 })).products.length, 24)
    assert.equal((await search({ offset: 1000 })).products.length, 0)
    assert.equal(Number((await search({ offset: 1000 })).total_count), 60)
    assert.equal(Number((await search({ categoryId: category })).total_count), 36)
    assert.equal(Number((await search({ query: "pRoDuCt 060" })).total_count), 1)
    assert.equal(Number((await search({ query: "%" })).total_count), 0)
    assert.equal(Number((await search({ query: "_" })).total_count), 0)
    assert.equal(Number((await search({ slug: "other-shop" })).total_count), 0)

    await db.query("update storefronts set status='draft' where business_id=$1", [business])
    assert.equal(Number((await search()).total_count), 0)
    assert.equal(Number((await search({ preview: true })).total_count), 0)
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner])
    assert.equal(Number((await search({ preview: true })).total_count), 60)
    assert.equal(Number((await search()).total_count), 0)
    // The granted anonymous RPC can read published data without table privileges.
    await db.query("update storefronts set status='published' where business_id=$1", [business])
    await db.exec("select set_config('request.jwt.claim.sub','',false); set role anon")
    assert.equal(Number((await search()).total_count), 60)
    await assert.rejects(db.query("select * from products"), /permission denied/)
  } finally {
    await db.close()
  }
})
