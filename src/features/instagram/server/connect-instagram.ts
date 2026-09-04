import "server-only"

import { createHash, randomBytes } from "node:crypto"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { getCurrentUser } from "@/lib/auth/session"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { createClient } from "@/lib/supabase/server"

import { instagramAuthorizationUrl } from "./meta-client"

const oauthLifetimeMs = 10 * 60 * 1_000

function setupError(code?: string) {
  return ["42883", "42P01", "PGRST202", "PGRST204", "PGRST205"].includes(code ?? "")
}

export function hashInstagramOAuthState(state: string) {
  return createHash("sha256").update(state, "utf8").digest("hex")
}

export async function startInstagramConnection(
  requestOrigin: string,
): Promise<JsonHandlerResult<{ redirectTo: string }>> {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to connect Instagram.")

  const business = await getCurrentBusiness()
  if (business.roleCode !== "owner") {
    throw new ApiError(
      403,
      "INSTAGRAM_CONNECT_FORBIDDEN",
      "Only the business owner can connect Instagram.",
    )
  }

  const state = randomBytes(32).toString("base64url")
  const redirectTo = instagramAuthorizationUrl(state, requestOrigin)
  const expiresAt = new Date(Date.now() + oauthLifetimeMs).toISOString()
  const supabase = await createClient()
  const { error } = await supabase.rpc("create_instagram_oauth_state", {
    target_business_id: business.id,
    target_expires_at: expiresAt,
    target_return_path: "/app/settings?section=integrations",
    target_state_hash: hashInstagramOAuthState(state),
  })

  if (error) {
    console.error("Instagram OAuth state creation failed", {
      code: error.code,
      message: error.message,
    })
    if (setupError(error.code)) {
      throw new ApiError(
        503,
        "INSTAGRAM_SETUP_REQUIRED",
        "Apply the Instagram database migration before connecting an account.",
      )
    }
    throw new ApiError(
      503,
      "INSTAGRAM_CONNECT_FAILED",
      "We couldn't start the Instagram connection. Please try again.",
    )
  }

  return { data: { redirectTo } }
}
