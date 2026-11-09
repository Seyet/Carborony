import assert from "node:assert/strict"
import { test } from "node:test"
import { loadTs } from "./helpers/load-ts.mjs"

const api = loadTs("src/lib/api/server.ts")
const credentials = { email: "person@example.com", password: "Password123", next: "/app/orders" }
function setup({ passwordError = null, deliveryError = null, otpError = null, session = {} } = {}) {
  const calls = []
  const service = loadTs("src/features/auth/server/service.ts", {
    "@supabase/supabase-js": {
      isAuthRetryableFetchError: () => false,
      createClient: (_url, _key, options) => {
        assert.equal(options.auth.persistSession, false)
        return { auth: {
          signInWithPassword: async () => { calls.push("password"); return { error: passwordError } },
          signOut: async () => { calls.push("cleanup"); return { error: null } },
          signInWithOtp: async (input) => {
            assert.deepEqual(input, { email: credentials.email, options: { shouldCreateUser: false } })
            calls.push("send"); return { error: deliveryError }
          },
        } }
      },
    },
    "@/lib/api/server": api,
    "@/lib/auth/redirect": { getSafeNextPath: (next) => next },
    "@/lib/supabase/env": { isSupabaseConfigured: () => true, getSupabaseEnvironment: () => ({ url: "https://example.com", anonKey: "test" }) },
    "@/lib/supabase/server": { createClient: async () => {
      calls.push("cookie-client")
      return { auth: { verifyOtp: async (input) => {
        assert.deepEqual(input, { email: credentials.email, token: "123456", type: "email" })
        return { data: { session, user: {} }, error: otpError }
      } } }
    } },
    "./password-security": {},
  })
  return { service, calls }
}

test("password login sends a code without creating browser session cookies", async () => {
  const { service, calls } = setup()
  const result = await service.login(credentials, new Headers())
  assert.deepEqual(result.data, { accepted: true })
  assert.deepEqual(calls, ["password", "cleanup", "send"])
})

test("invalid passwords cannot send or verify login codes", async () => {
  for (const method of ["login", "verifyLoginOtp"]) {
    const { service, calls } = setup({ passwordError: { code: "invalid_credentials" } })
    await assert.rejects(service[method]({ ...credentials, token: "123456" }, new Headers()), { code: "INVALID_CREDENTIALS" })
    assert.deepEqual(calls, ["password"])
  }
})

test("delivery rate limits are surfaced instead of reporting code sent", async () => {
  const { service } = setup({ deliveryError: { code: "over_email_send_rate_limit" } })
  await assert.rejects(service.login(credentials, new Headers()), { status: 429, code: "RATE_LIMITED" })
})

test("valid login codes establish a session and preserve the next destination", async () => {
  const { service, calls } = setup()
  const result = await service.verifyLoginOtp({ ...credentials, token: "123456" }, new Headers())
  assert.equal(result.data.redirectTo, credentials.next)
  assert.deepEqual(calls, ["password", "cleanup", "cookie-client"])
})

test("expired codes and missing sessions cannot complete login", async () => {
  for (const [options, code] of [
    [{ otpError: { code: "otp_expired" } }, "INVALID_OTP"],
    [{ session: null }, "OTP_VERIFICATION_FAILED"],
  ]) {
    const { service } = setup(options)
    await assert.rejects(service.verifyLoginOtp({ ...credentials, token: "123456" }, new Headers()), { code })
  }
})
