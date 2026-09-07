import assert from "node:assert/strict"
import { test } from "node:test"
import { loadTs } from "./helpers/load-ts.mjs"

const api = loadTs("src/lib/api/server.ts")
const schemas = loadTs("src/features/payments/schemas.ts")
const paystack = loadTs("src/features/payments/server/paystack.ts", { "@/lib/api/server": api })
const verified = { bankCode: "058", bankName: "Test Bank", accountNumber: "0123456789", accountName: "TEST BUSINESS" }
const createInput = { action: "create", ...verified, commissionPercent: 0, confirmed: true }
const providerAccount = { subaccount_code: "ACCT_test123", domain: "test", currency: "NGN", account_number: verified.accountNumber, percentage_charge: 0, active: true, is_verified: false }
const initialRow = { id: "row-1", business_id: "business-1", operation_id: "operation-1", provider_mode: "test", status: "creating", account_last_four: "6789", commission_percent: 0, account_name: verified.accountName, bank_name: verified.bankName, provider_active: false, provider_verified: false, subaccount_code: null }

function harness({ seed = null, role = "owner", user = { id: "user-1" }, ownerId = "user-1", supported = true, reserveError, failFinalSave = false, provider = {} } = {}) {
  const state = { row: seed, mutations: [], providerCreates: 0, resolves: 0, reconciles: 0 }
  const client = {
    from(table) {
      let action = "read", values
      const filters = []
      const query = {
        select() { return query },
        eq(key, value) { filters.push([key, value]); return query },
        insert(input) { action = "insert"; values = input; return query },
        update(input) { action = "update"; values = input; return query },
        delete() { action = "delete"; return query },
        single() { return Promise.resolve(execute()) },
        maybeSingle() { return Promise.resolve(execute()) },
        then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject) },
      }
      function execute() {
        if (table === "businesses") return { data: { created_by: ownerId, country_code: supported ? "NG" : "GH", currency_code: "NGN" }, error: null }
        assert.equal(table, "business_payment_accounts")
        if (action === "read") return { data: state.row, error: null }
        state.mutations.push({ action, values })
        if (action === "insert") {
          if (reserveError) return { data: null, error: reserveError }
          state.row = { ...initialRow, ...values }
        }
        if (action === "update" && failFinalSave && values.status === "connected") return { data: null, error: { code: "08006" } }
        if (action !== "insert" && !filters.every(([key, value]) => state.row?.[key] === value)) return { data: null, error: null }
        if (action === "update") state.row = { ...state.row, ...values }
        if (action === "delete") state.row = null
        return { data: state.row, error: null }
      }
      return query
    },
  }
  const defaults = {
    paymentEnvironment: () => ({ mode: "test", commissionPercent: 0, secret: "sk_test_secret" }),
    resolvePaymentAccount: async () => { state.resolves++; return verified },
    createPaymentSubaccount: async () => { state.providerCreates++; return providerAccount },
    findPaymentSubaccount: async () => { state.reconciles++; return providerAccount },
    fetchPaymentSubaccount: async () => providerAccount,
    PaystackRequestError: paystack.PaystackRequestError,
  }
  const service = loadTs("src/features/payments/server/manage-payment-setup.ts", {
    "@/lib/api/server": api,
    "@/features/businesses/server/get-current-business": { getCurrentBusiness: async () => ({ id: "business-1", name: "Test Business", roleCode: role }) },
    "@/lib/auth/session": { getCurrentUser: async () => user },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/supabase/admin": { createAdminClient: () => client },
    "@/lib/supabase/env": { getSupabaseAdminEnvironment: () => ({}) },
    "./paystack": { ...defaults, ...provider },
  })
  return { state, run: service.managePaymentSetup }
}

test("setup requires explicit confirmation and valid bank details", () => {
  assert.equal(schemas.paymentSetupSchema.safeParse(createInput).success, true)
  for (const change of [{ confirmed: false }, { confirmed: undefined }, { accountNumber: "123" }, { commissionPercent: -1 }]) {
    assert.equal(schemas.paymentSetupSchema.safeParse({ ...createInput, ...change }).success, false)
  }
})

test("non-owners and unauthenticated users cannot reach provider operations", async () => {
  for (const options of [{ role: "staff" }, { role: "admin" }, { user: null }, { ownerId: "another-user" }]) {
    const h = harness(options)
    await assert.rejects(h.run(createInput), error => [401, 403].includes(error.status))
    assert.equal(h.state.providerCreates, 0)
    assert.equal(h.state.mutations.length, 0)
  }
})

test("unsupported business regions are rejected before verification", async () => {
  const h = harness({ supported: false })
  await assert.rejects(h.run(createInput), { code: "PAYMENTS_REGION_UNSUPPORTED" })
  assert.equal(h.state.resolves, 0)
})

test("client changes to account name or commission cannot create a subaccount", async () => {
  for (const change of [{ accountName: "SOMEONE ELSE" }, { commissionPercent: 5 }]) {
    const h = harness()
    await assert.rejects(h.run({ ...createInput, ...change }), error => error.status === 409)
    assert.equal(h.state.providerCreates, 0)
    assert.equal(h.state.mutations.length, 0)
  }
})

test("confirmed setup reserves one slot, creates the account and stores only masked bank details", async () => {
  const h = harness()
  const result = await h.run(createInput)
  assert.equal(result.data.account.status, "connected")
  assert.equal(result.data.account.accountLastFour, "6789")
  assert.equal(h.state.providerCreates, 1)
  assert.equal(h.state.resolves, 1)
  assert.equal(JSON.stringify(h.state.mutations).includes(verified.accountNumber), false)
  assert.equal(result.data.mode, "test")
  assert.equal(result.data.account.providerVerified, false)
})

test("a concurrent reservation cannot create a duplicate provider account", async () => {
  const h = harness({ reserveError: { code: "23505" } })
  await assert.rejects(h.run(createInput), { code: "PAYMENT_SETUP_IN_PROGRESS" })
  assert.equal(h.state.providerCreates, 0)
})

test("uncertain creation preserves the slot and retry reconciles instead of creating again", async () => {
  const h = harness({ provider: { createPaymentSubaccount: async () => { throw new TypeError("fetch failed") } } })
  const result = await h.run(createInput)
  assert.equal(result.status, 202)
  assert.equal(h.state.row.status, "reconciliation_required")
  const retried = await h.run(createInput)
  assert.equal(retried.data.account.status, "connected")
  assert.equal(h.state.reconciles, 1)
  assert.equal(h.state.mutations.filter(mutation => mutation.action === "insert").length, 1)
})

test("an unresolved prior attempt remains pending without another provider creation", async () => {
  const h = harness({ seed: initialRow, provider: { findPaymentSubaccount: async () => null } })
  const result = await h.run(createInput)
  assert.equal(result.data.account.status, "creating")
  assert.equal(h.state.providerCreates, 0)
})

test("a confirmed provider rejection releases the reservation for corrected details", async () => {
  const h = harness({ provider: { createPaymentSubaccount: async () => { throw new paystack.PaystackRequestError(true, 422, "REJECTED", "Rejected") } } })
  await assert.rejects(h.run(createInput), { code: "REJECTED" })
  assert.equal(h.state.row, null)
})

test("a persistence failure after provider creation remains recoverable", async () => {
  const h = harness({ failFinalSave: true })
  const result = await h.run(createInput)
  assert.equal(result.status, 202)
  assert.equal(h.state.row.status, "reconciliation_required")
  assert.equal(h.state.providerCreates, 1)
})

test("existing accounts are reused and test/live provider mismatches are blocked", async () => {
  const h = harness({ seed: { ...initialRow, status: "connected", subaccount_code: "ACCT_test123" } })
  await h.run(createInput)
  assert.equal(h.state.providerCreates, 0)
  const wrongMode = harness({ provider: { createPaymentSubaccount: async () => ({ ...providerAccount, domain: "live" }) } })
  const result = await wrongMode.run(createInput)
  assert.equal(result.data.account.status, "reconciliation_required")
  assert.equal(wrongMode.state.row.subaccount_code, null)
})

test("provider POST timeouts are not retried and never expose bank numbers in errors", async () => {
  const savedKey = process.env.PAYSTACK_SECRET_KEY
  const savedFee = process.env.PAYSTACK_PLATFORM_COMMISSION_PERCENT
  const savedFetch = globalThis.fetch
  process.env.PAYSTACK_SECRET_KEY = "sk_test_example"
  process.env.PAYSTACK_PLATFORM_COMMISSION_PERCENT = "0"
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error(`Failed to send ${verified.accountNumber}`) }
  try {
    await assert.rejects(paystack.createPaymentSubaccount({ ...verified, businessName: "Test", businessId: "test-id", operationId: "op-id", commissionPercent: 0 }), error => {
      assert.equal(error.definitiveRejection, false)
      assert.equal(error.message.includes(verified.accountNumber), false)
      return true
    })
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = savedFetch
    if (savedKey === undefined) delete process.env.PAYSTACK_SECRET_KEY; else process.env.PAYSTACK_SECRET_KEY = savedKey
    if (savedFee === undefined) delete process.env.PAYSTACK_PLATFORM_COMMISSION_PERCENT; else process.env.PAYSTACK_PLATFORM_COMMISSION_PERCENT = savedFee
  }
})

test("bank listing follows pagination, filters unavailable banks, and preserves leading zeros", async () => {
  const savedKey = process.env.PAYSTACK_SECRET_KEY
  const savedFee = process.env.PAYSTACK_PLATFORM_COMMISSION_PERCENT
  const savedFetch = globalThis.fetch
  process.env.PAYSTACK_SECRET_KEY = "sk_test_example"
  process.env.PAYSTACK_PLATFORM_COMMISSION_PERCENT = "29.99"
  const calls = []
  globalThis.fetch = async (url, init) => {
    assert.equal(init.method, "GET")
    const parsed = new URL(url)
    calls.push(parsed)
    let data
    let meta
    if (parsed.pathname === "/bank/resolve") {
      assert.equal(parsed.searchParams.get("account_number"), "0123456789")
      data = { account_number: "0123456789", account_name: "TEST BUSINESS" }
    } else if (!parsed.searchParams.has("next")) {
      assert.equal(parsed.searchParams.get("use_cursor"), "true")
      assert.equal(parsed.searchParams.has("page"), false)
      // Paystack can return 99 rows with perPage=100 and still have another page.
      data = Array.from({ length: 99 }, (_, i) => ({ code: String(100 + i), name: `Bank ${i}`, active: false, currency: "NGN", country: "Nigeria" }))
      meta = { next: "opaque+cursor/==" }
    } else {
      assert.equal(parsed.searchParams.get("next"), "opaque+cursor/==")
      data = [{ code: "058", name: "Test Bank", active: true, currency: "NGN", country: "Nigeria" }]
      meta = { next: null }
    }
    return new Response(JSON.stringify({ status: true, data, meta }), { status: 200 })
  }
  try {
    assert.equal(paystack.paymentEnvironment().commissionPercent, 29.99)
    assert.deepEqual(await paystack.listPaymentBanks(), [{ code: "058", name: "Test Bank" }])
    assert.equal(calls.length, 2)
    assert.equal((await paystack.resolvePaymentAccount("058", "0123456789")).accountNumber, "0123456789")
    await assert.rejects(paystack.resolvePaymentAccount("999", "0123456789"), { code: "BANK_UNAVAILABLE" })
  } finally {
    globalThis.fetch = savedFetch
    if (savedKey === undefined) delete process.env.PAYSTACK_SECRET_KEY; else process.env.PAYSTACK_SECRET_KEY = savedKey
    if (savedFee === undefined) delete process.env.PAYSTACK_PLATFORM_COMMISSION_PERCENT; else process.env.PAYSTACK_PLATFORM_COMMISSION_PERCENT = savedFee
  }
})

test("bank listing rejects missing or repeated pagination cursors instead of returning an incomplete list", async () => {
  const savedKey = process.env.PAYSTACK_SECRET_KEY
  const savedFetch = globalThis.fetch
  process.env.PAYSTACK_SECRET_KEY = "sk_test_example"
  try {
    for (const meta of [undefined, { next: "repeated" }]) {
      let calls = 0
      globalThis.fetch = async () => {
        calls++
        return Response.json({ status: true, data: [], meta })
      }
      await assert.rejects(paystack.listPaymentBanks(), { status: 502, code: "BANK_LIST_UNAVAILABLE" })
      assert.equal(calls, meta ? 2 : 1)
    }
  } finally {
    globalThis.fetch = savedFetch
    if (savedKey === undefined) delete process.env.PAYSTACK_SECRET_KEY; else process.env.PAYSTACK_SECRET_KEY = savedKey
  }
})
