import assert from "node:assert/strict"
import { test } from "node:test"
import { loadTs } from "./helpers/load-ts.mjs"

test("storefront phone validation gives useful customer messages", () => {
  const { storefrontPhoneSchema } = loadTs("src/features/storefront/schemas.ts")

  const missing = storefrontPhoneSchema.safeParse("   ")
  assert.equal(missing.success, false)
  assert.equal(missing.error.issues[0].message, "Enter your phone number.")

  const malformed = storefrontPhoneSchema.safeParse("phone-number")
  assert.equal(malformed.success, false)
  assert.equal(
    malformed.error.issues[0].message,
    "Enter a valid phone number using digits and an optional country code.",
  )

  const tooShort = storefrontPhoneSchema.safeParse("12345")
  assert.equal(tooShort.success, false)
  assert.equal(
    tooShort.error.issues[0].message,
    "Enter a valid phone number with 7 to 15 digits.",
  )

  assert.equal(storefrontPhoneSchema.safeParse("+234 801 234 5678").success, true)
})

test("public storefront STABLE RPCs use retryable GET requests", async () => {
  const calls = []
  const client = {
    rpc(name, args, options) {
      calls.push({ name, args, options })
      if (name === "get_public_storefront") {
        return { maybeSingle: async () => ({ data: null, error: null, status: 200 }) }
      }
      return Promise.resolve({ data: [], error: null, status: 200 })
    },
  }
  const storefront = loadTs("src/features/storefront/server/get-public-storefront.ts", {
    react: { cache: fn => fn },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/features/payments/server/storefront-payments": { onlinePaymentMode: async () => null },
    "../copy": { storefrontCopy: () => ({}) },
    "./media-url": { publicStorageUrl: () => null },
  })

  assert.equal(await storefront.getPublicStorefront("test-shop", false, "00000000-0000-4000-8000-000000000001"), null)
  assert.deepEqual(calls.map(call => [call.name, call.options]).sort(([a], [b]) => a.localeCompare(b)), [
    ["get_public_storefront", { get: true }],
    ["get_public_storefront_products", { get: true }],
  ])
})


test("store settings and cart rendering do not load the catalogue", async () => {
  const calls = []
  const storefront = loadTs("src/features/storefront/server/get-public-storefront.ts", {
    react: { cache: fn => fn },
    "@/lib/supabase/server": { createClient: async () => ({
      rpc(name) {
        calls.push(name)
        return { maybeSingle: async () => ({ data: null, error: null }) }
      },
    }) },
    "@/features/payments/server/storefront-payments": { onlinePaymentMode: async () => null },
    "../copy": { storefrontCopy: () => ({}) },
    "./media-url": { publicStorageUrl: () => null },
  })
  assert.equal(await storefront.getPublicStorefrontInfo("test-shop"), null)
  assert.deepEqual(calls, ["get_public_storefront"])
})

test("catalogue requests are bounded and reject invalid pagination and category input", async () => {
  const calls = []
  const search = loadTs("src/features/storefront/server/search-public-storefront.ts", {
    "@/lib/supabase/server": { createClient: async () => ({
      rpc(name, args, options) {
        calls.push({ name, args, options })
        return { single: async () => ({ data: { products: [], categories: [], total_count: 49, store_count: 60, featured_count: 2 }, error: null }) }
      },
    }) },
    "./get-public-storefront": { mapStorefrontProducts: rows => rows },
  })
  for (const page of ["-1", "NaN", "1.5", "10001", "Infinity"]) {
    assert.equal(search.parseStorefrontFilters({ page }).page, 1)
  }
  assert.equal(search.parseStorefrontFilters({ category: "not-a-uuid" }).category, "")
  assert.equal(search.parseStorefrontFilters({ query: "a".repeat(200) }).query.length, 100)
  const filters = search.parseStorefrontFilters({ page: "2", query: " Shirt " })
  const result = await search.searchPublicStorefront("shop", true, filters)
  assert.equal(result.pageCount, 3)
  assert.deepEqual(calls[0], {
    name: "search_public_storefront_products",
    args: { store_slug: "shop", include_draft: true, search_query: "Shirt", selected_category_id: undefined, result_limit: 24, result_offset: 24 },
    options: { get: true },
  })
})
