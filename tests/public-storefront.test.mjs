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

  assert.equal(await storefront.getPublicStorefront("test-shop"), null)
  assert.deepEqual(calls.map(call => [call.name, call.options]), [
    ["get_public_storefront", { get: true }],
    ["get_public_storefront_products", { get: true }],
  ])
})
