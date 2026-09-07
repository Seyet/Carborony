import assert from "node:assert/strict"
import { test } from "node:test"
import { loadTs } from "./helpers/load-ts.mjs"

const api = loadTs("src/lib/api/server.ts")
const security = loadTs("src/features/auth/server/password-security.ts")
const schemas = loadTs("src/features/auth/schemas.ts")

function service(auth) {
  return loadTs("src/features/auth/server/service.ts", {
    "@/lib/api/server": api,
    "@/lib/auth/redirect": { getSafeNextPath: () => "/app/dashboard" },
    "@/lib/supabase/env": { isSupabaseConfigured: () => true },
    "@/lib/supabase/server": {
      createClient: async (options) => {
        assert.equal(options.strictCookieWrites, true)
        assert.ok(options.responseHeaders instanceof Headers)
        return { auth }
      },
    },
    "./password-security": security,
  })
}

const email = "person@example.com"
const resetInput = { password: "NewPassword123", confirmPassword: "NewPassword123" }

function resetAuth(methods) {
  return {
    getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
    mfa: {
      getAuthenticatorAssuranceLevel: async () => ({
        data: { currentAuthenticationMethods: methods }, error: null,
      }),
    },
    updateUser: async () => { throw new Error("Password must not be changed") },
  }
}

test("recovery accepts numeric codes and normalizes email, rejecting malformed input", () => {
  assert.deepEqual(schemas.verifyRecoveryOtpSchema.parse({ email: " PERSON@example.com ", token: " 123456 " }), {
    email, token: "123456",
  })
  assert.ok(schemas.verifyRecoveryOtpSchema.safeParse({ email, token: "12345678" }).success)
  for (const token of ["", "12345", "123456789", "abcdef", "123 456"]) {
    assert.equal(schemas.verifyRecoveryOtpSchema.safeParse({ email, token }).success, false)
  }
})

test("requesting recovery does not disclose an unknown account", async () => {
  const responses = []
  for (const error of [null, { code: "user_not_found" }]) {
    responses.push(await service({
      resetPasswordForEmail: async (address, options) => {
        assert.equal(address, email)
        assert.equal(new URL(options.redirectTo).searchParams.get("flow"), "recovery")
        return { error }
      },
    }).forgotPassword({ email }, "https://example.com", new Headers()))
  }
  assert.deepEqual(responses[0], responses[1])
  assert.equal(responses[0].data.accepted, true)
})

test("recovery email rate limits are surfaced for retry", async () => {
  await assert.rejects(service({
    resetPasswordForEmail: async () => ({ error: { code: "over_email_send_rate_limit" } }),
  }).forgotPassword({ email }, "https://example.com", new Headers()), { status: 429, code: "RATE_LIMITED" })
})

test("verification uses recovery tokens and requires a session before redirecting", async () => {
  const result = await service({
    verifyOtp: async (input) => {
      assert.deepEqual(input, { email, token: "123456", type: "recovery" })
      return { data: { session: { access_token: "test" }, user: { id: "user-1" } }, error: null }
    },
  }).verifyRecoveryOtp({ email, token: "123456" }, new Headers())
  assert.equal(result.data.redirectTo, "/reset-password")
})

test("expired or invalid recovery codes never advance to password reset", async () => {
  await assert.rejects(service({
    verifyOtp: async () => ({ data: { session: null, user: null }, error: { code: "otp_expired" } }),
  }).verifyRecoveryOtp({ email, token: "123456" }, new Headers()), { status: 422, code: "INVALID_OTP" })
})

test("verification without an authenticated session is rejected", async () => {
  await assert.rejects(service({
    verifyOtp: async () => ({ data: { session: null, user: { id: "user-1" } }, error: null }),
  }).verifyRecoveryOtp({ email, token: "123456" }, new Headers()), { code: "OTP_VERIFICATION_FAILED" })
})

test("password changes reject missing sessions and stale or password-only verification", async () => {
  await assert.rejects(service({
    getUser: async () => ({ data: { user: null }, error: null }),
  }).resetPassword(resetInput, new Headers()), { code: "RECOVERY_SESSION_EXPIRED" })
  const now = Math.floor(Date.now() / 1000)
  for (const methods of [[], [{ method: "password", timestamp: now }], [{ method: "recovery", timestamp: now - 3600 }]]) {
    await assert.rejects(service(resetAuth(methods)).resetPassword(resetInput, new Headers()), {
      code: "RECOVERY_VERIFICATION_REQUIRED",
    })
  }
})

test("recent email proof allows a password change, then clears the local session", async () => {
  const auth = resetAuth([{ method: "otp", timestamp: Math.floor(Date.now() / 1000) }])
  let updated = false
  let signedOut = false
  auth.updateUser = async (input) => {
    assert.equal(input.password, resetInput.password)
    updated = true
    return { error: null }
  }
  auth.signOut = async (input) => {
    assert.equal(updated, true)
    assert.equal(input.scope, "local")
    signedOut = true
    return { error: null }
  }
  const result = await service(auth).resetPassword(resetInput, new Headers())
  assert.equal(signedOut, true)
  assert.equal(result.data.redirectTo, "/login?reset=success")
})

test("reused and weak passwords return actionable errors", async () => {
  for (const [providerCode, code] of [["same_password", "SAME_PASSWORD"], ["weak_password", "WEAK_PASSWORD"]]) {
    const auth = resetAuth([{ method: "recovery", timestamp: Math.floor(Date.now() / 1000) }])
    auth.updateUser = async () => ({ error: { code: providerCode } })
    await assert.rejects(service(auth).resetPassword(resetInput, new Headers()), { status: 422, code })
  }
})
