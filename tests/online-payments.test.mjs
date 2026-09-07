import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { test } from "node:test"
import { loadTs } from "./helpers/load-ts.mjs"

const api = loadTs("src/lib/api/server.ts")
const paystack = loadTs("src/features/payments/server/paystack.ts", { "@/lib/api/server": api })
const environment = () => ({ secret: "sk_test_example", mode: "test", commissionPercent: 0 })
const schemas = loadTs("src/features/payments/checkout-schemas.ts")
const reference = `CB-${"a".repeat(32)}`
const row = { reference, order_id: "order-1", business_id: "business-1", order_number: "WEB-1", store_slug: "test-shop", buyer_email: "buyer@example.com", provider_mode: "test", amount_minor: 250050, currency_code: "NGN", commission_percent: 2.5, subaccount_code: "ACCT_example", status: "created", authorization_url: null }
const transaction = { id: 1234, reference, amount: row.amount_minor, currency: "NGN", domain: "test", status: "success", metadata: { order_id: row.order_id, business_id: row.business_id, subaccount_code: row.subaccount_code } }
const provider = loadTs("src/features/payments/server/online-payment-provider.ts", {
  "@/lib/api/server": api, "./paystack": { paymentEnvironment: environment },
})

function harness({ payment = { ...row }, verified = transaction, initializeError, saveError, settleError } = {}) {
  const state = { payment, initializations: 0, verifications: 0, settlements: 0, initialized: null, rpcInput: null }
  const db = {
    rpc(name, args) {
      if (name === "create_storefront_online_order") {
        state.rpcInput = args
        return { single: async () => ({ data: { ...state.payment }, error: null }) }
      }
      assert.equal(name, "settle_storefront_payment")
      state.settlements++
      assert.equal(args.verified_amount, row.amount_minor)
      if (!settleError) state.payment.status = "paid"
      return Promise.resolve({ data: settleError ? null : "paid", error: settleError })
    },
    from(table) {
      assert.equal(table, "storefront_payments")
      let values
      const filters = []
      const query = {
        select() { return query }, eq(key, value) { filters.push([key, value]); return query },
        update(input) { values = input; return query },
        maybeSingle() { return Promise.resolve(execute()) },
        then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject) },
      }
      function execute() {
        if (saveError && values?.status === "ready") return { data: null, error: saveError }
        if (!state.payment || !filters.every(([key, value]) => state.payment[key] === value)) return { data: null, error: null }
        if (values) Object.assign(state.payment, values)
        return { data: { ...state.payment }, error: null }
      }
      return query
    },
  }
  const service = loadTs("src/features/payments/server/storefront-payments.ts", {
    "@/lib/api/server": api, "@/lib/supabase/admin": { createAdminClient: () => db },
    "./paystack": { paymentEnvironment: environment, PaystackRequestError: paystack.PaystackRequestError },
    "./online-payment-provider": {
      checkoutOrigin: () => "https://shop.example", isPaystackCheckoutUrl: provider.isPaystackCheckoutUrl,
      initializeOnlinePayment: async input => { state.initializations++; state.initialized = input; if (initializeError) throw initializeError; return "https://checkout.paystack.com/example" },
      verifyOnlinePayment: async () => { state.verifications++; return verified },
    },
  })
  return { state, ...service }
}
const input = { slug: "test-shop", buyerEmail: "buyer@example.com", buyerName: "Test Buyer", buyerPhone: "08012345678", deliveryAddress: null, deliveryMethod: "pickup", deliveryZoneId: null, idempotencyKey: "id", items: [{ productId: "product-1", quantity: 2, variantId: null }], paymentMethod: "online", notes: null }

test("online checkout uses the saved amount and destination and reuses an initialized reference", async () => {
  const h = harness()
  const first = await h.createOnlineStorefrontOrder({ ...input, amount: 1, subaccount: "ACCT_attacker" })
  const second = await h.createOnlineStorefrontOrder(input)
  assert.equal(first.data.paymentReference, second.data.paymentReference)
  assert.equal(h.state.initializations, 1)
  assert.equal(h.state.initialized.amount, row.amount_minor)
  assert.equal(h.state.initialized.subaccount, row.subaccount_code)
  assert.equal(first.data.paymentMethod, "online")
})

test("concurrent initialization and lost provider/database responses never create another payment", async () => {
  for (const options of [{}, { initializeError: new Error("timeout") }, { saveError: { code: "08006" } }]) {
    const h = harness(options)
    await Promise.all([h.createOnlineStorefrontOrder(input), h.createOnlineStorefrontOrder(input)])
    await h.createOnlineStorefrontOrder(input)
    assert.equal(h.state.initializations, 1)
  }
})

test("explicit initialization rejection releases only the existing reference for retry", async () => {
  const h = harness({ initializeError: new paystack.PaystackRequestError(true, 422, "REJECTED", "Rejected") })
  await assert.rejects(h.createOnlineStorefrontOrder(input), { code: "PAYMENT_REJECTED" })
  assert.equal(h.state.payment.status, "created")
  assert.equal(h.state.payment.reference, reference)
})

test("verification rejects wrong store, mode, amount, currency, reference, or order metadata", async () => {
  const wrongStore = harness()
  assert.equal(await wrongStore.reconcileStorefrontPayment(reference, "another-store"), null)
  assert.equal(wrongStore.state.verifications, 0)
  for (const changed of [{ domain: "live" }, { amount: 1 }, { currency: "USD" }, { reference: "another-reference" }, { metadata: null }, { metadata: { ...transaction.metadata, subaccount_code: "ACCT_other" } }, { metadata: { ...transaction.metadata, order_id: "order-2" } }]) {
    const h = harness({ verified: { ...transaction, ...changed } })
    await assert.rejects(h.reconcileStorefrontPayment(reference, "test-shop"), { code: "PAYMENT_MISMATCH" })
    assert.equal(h.state.settlements, 0)
  }
})

test("pending and failed transactions cannot mark orders paid", async () => {
  for (const status of ["ongoing", "pending", "abandoned", "failed", "reversed"]) {
    const h = harness({ verified: { ...transaction, status } })
    const result = await h.reconcileStorefrontPayment(reference)
    assert.notEqual(result.status, "paid")
    assert.equal(h.state.settlements, 0)
  }
})

test("success settles once and database failure is not reported as paid", async () => {
  const h = harness()
  assert.equal((await h.reconcileStorefrontPayment(reference)).status, "paid")
  assert.equal((await h.reconcileStorefrontPayment(reference)).status, "paid")
  assert.equal(h.state.settlements, 1)
  const failure = harness({ settleError: { code: "08006" } })
  await assert.rejects(failure.reconcileStorefrontPayment(reference), { code: "PAYMENT_SAVE_FAILED" })
})

test("checkout redirects are restricted to Paystack and raw-body HMAC detects tampering", () => {
  assert.equal(provider.isPaystackCheckoutUrl("https://checkout.paystack.com/test"), true)
  for (const url of ["https://checkout.paystack.com.evil.test/", "javascript:alert(1)", "http://checkout.paystack.com/", "https://user:pass@checkout.paystack.com/"]) assert.equal(provider.isPaystackCheckoutUrl(url), false)
  const body = Buffer.from('{ "event": "charge.success" }')
  const signature = createHmac("sha512", environment().secret).update(body).digest("hex")
  assert.equal(provider.validPaystackSignature(body, signature), true)
  assert.equal(provider.validPaystackSignature(Buffer.from('{}'), signature), false)
  assert.equal(provider.validPaystackSignature(body, "bad-signature"), false)
})

test("payment callbacks accept Paystack's matching duplicate references and reject conflicts", () => {
  assert.equal(schemas.paymentCallbackReference([reference, reference], reference), reference)
  assert.equal(schemas.paymentCallbackReference(reference, reference), reference)
  assert.equal(schemas.paymentCallbackReference(undefined, reference), reference)
  assert.equal(schemas.paymentCallbackReference([reference, "CB-bad"], reference), null)
  assert.equal(schemas.paymentCallbackReference(reference, `CB-${"b".repeat(32)}`), null)
})

test("webhook acknowledges only verified, committed payments and ignores unrelated events", async () => {
  for (const options of [{ valid: false, expected: 401 }, { valid: true, error: true, expected: 503 }, { valid: true, status: "pending", expected: 503 }, { valid: true, status: "paid", expected: 200 }]) {
    let calls = 0
    const webhook = loadTs("src/features/payments/server/paystack-webhook.ts", {
      "../checkout-schemas": schemas,
      "./online-payment-provider": { validPaystackSignature: () => options.valid },
      "./storefront-payments": { reconcileStorefrontPayment: async () => { calls++; if (options.error) throw new Error("Database down"); return { status: options.status } } },
    })
    const response = await webhook.handlePaystackWebhook(new Request("https://shop.example/webhook", { method: "POST", body: JSON.stringify({ event: "charge.success", data: { reference } }) }))
    assert.equal(response.status, options.expected)
    assert.equal(calls, options.valid ? 1 : 0)
  }
})

test("provider initialization sends kobo, approved commission and the canonical callback", async () => {
  const saved = process.env.PAYMENTS_APP_URL
  process.env.PAYMENTS_APP_URL = "https://shop.example"
  let sent
  const boundary = loadTs("src/features/payments/server/online-payment-provider.ts", {
    "@/lib/api/server": api,
    "./paystack": { paymentEnvironment: environment, paystackRequest: async (path, body) => {
      assert.equal(path, "/transaction/initialize"); sent = body
      return { reference, authorization_url: "https://checkout.paystack.com/example" }
    } },
  })
  try {
    await boundary.initializeOnlinePayment({ reference, email: row.buyer_email, amount: row.amount_minor, subaccount: row.subaccount_code, commissionPercent: 2.5, slug: row.store_slug, orderId: row.order_id, businessId: row.business_id })
    assert.equal(sent.amount, "250050")
    assert.equal(sent.transaction_charge, 6251)
    assert.equal(sent.bearer, "account")
    assert.equal(new URL(sent.callback_url).origin, "https://shop.example")
    assert.equal(new URL(sent.callback_url).pathname, "/store/test-shop/payment")
    assert.equal(new URL(sent.callback_url).search, "")
    sent = null
    await boundary.initializeOnlinePayment({ reference, email: row.buyer_email, amount: row.amount_minor, subaccount: row.subaccount_code, commissionPercent: 0, slug: row.store_slug, orderId: row.order_id, businessId: row.business_id })
    assert.equal(Object.hasOwn(sent, "transaction_charge"), false)
  } finally { if (saved === undefined) delete process.env.PAYMENTS_APP_URL; else process.env.PAYMENTS_APP_URL = saved }
})
