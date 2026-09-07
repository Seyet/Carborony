import assert from "node:assert/strict"
import { test } from "node:test"
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/supabase-js"
import { z } from "zod"
import { loadTs } from "./helpers/load-ts.mjs"

const api = loadTs("src/lib/api/server.ts")

function session(result) {
  return loadTs("src/lib/auth/session.ts", {
    react: { cache: fn => fn },
    "next/navigation": { redirect: () => { throw new Error("Unexpected login redirect") } },
    "@/lib/api/server": api,
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => result } }) },
  })
}

test("session verification returns only a verified user and rejects missing or invalid sessions", async () => {
  const user = { id: "verified-user" }
  assert.equal(await session({ data: { user }, error: null }).getCurrentUser(), user)
  for (const error of [null, new AuthSessionMissingError(), new AuthApiError("Invalid JWT", 401, "bad_jwt")]) {
    assert.equal(await session({ data: { user: null }, error }).getCurrentUser(), null)
  }
})

test("Auth outages and rate limits reach JSON clients as retryable errors without login redirects", async () => {
  for (const [error, status, code] of [
    [new AuthRetryableFetchError("fetch failed", 0), 503, "AUTH_UNAVAILABLE"],
    [new AuthApiError("Service unavailable", 503), 503, "AUTH_UNAVAILABLE"],
    [new AuthApiError("Request rate limit reached", 429), 429, "AUTH_RATE_LIMITED"],
  ]) {
    const auth = session({ data: { user: null }, error })
    const response = await api.handleJsonPost(new Request("https://example.com/api/settings/payments", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    }), z.object({}), async () => ({ data: await auth.requireUser() }))
    assert.equal(response.status, status)
    assert.equal((await response.json()).error.code, code)
  }
})
