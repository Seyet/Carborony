import "server-only"

import { createHash, randomBytes } from "node:crypto"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { getCurrentUser } from "@/lib/auth/session"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { createClient } from "@/lib/supabase/server"

import { instagramAuthorizationUrl } from "./meta-client"
import {
  logInstagramError,
  logInstagramInfo,
  logInstagramWarning,
  newInstagramTraceId,
} from "./logger"

const oauthLifetimeMs = 10 * 60 * 1_000

function setupError(code?: string) {
  return ["42883", "42P01", "PGRST202", "PGRST204", "PGRST205"].includes(code ?? "")
}

export function hashInstagramOAuthState(state: string) {
  return createHash("sha256").update(state, "utf8").digest("hex")
}

export async function startInstagramConnection(
  requestOrigin: string,
  suppliedTraceId?: string,
): Promise<JsonHandlerResult<{ redirectTo: string }>> {
  const traceId = suppliedTraceId ?? newInstagramTraceId()
  const startedAt = Date.now()
  const user = await getCurrentUser()
  if (!user) {
    logInstagramWarning("oauth.start_rejected", { reason: "auth_required", traceId })
    throw new ApiError(401, "AUTH_REQUIRED", "Sign in to connect Instagram.")
  }

  const business = await getCurrentBusiness()
  if (business.roleCode !== "owner") {
    logInstagramWarning("oauth.start_rejected", {
      businessId: business.id,
      reason: "owner_required",
      traceId,
      userId: user.id,
    })
    throw new ApiError(
      403,
      "INSTAGRAM_CONNECT_FORBIDDEN",
      "Only the business owner can connect Instagram.",
    )
  }

  const state = randomBytes(32).toString("base64url")
  const stateHash = hashInstagramOAuthState(state)
  const stateReference = stateHash.slice(0, 12)
  logInstagramInfo("oauth.start_requested", {
    businessId: business.id,
    stateReference,
    traceId,
    userId: user.id,
  })
  const redirectTo = instagramAuthorizationUrl(state, requestOrigin)
  const expiresAt = new Date(Date.now() + oauthLifetimeMs).toISOString()
  const supabase = await createClient()
  const { error } = await supabase.rpc("create_instagram_oauth_state", {
    target_business_id: business.id,
    target_expires_at: expiresAt,
    target_return_path: "/app/settings?section=integrations",
    target_state_hash: stateHash,
  })

  if (error) {
    logInstagramError("oauth.state_creation_failed", error, {
      businessId: business.id,
      durationMs: Date.now() - startedAt,
      stateReference,
      traceId,
      userId: user.id,
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

  logInstagramInfo("oauth.state_created", {
    businessId: business.id,
    durationMs: Date.now() - startedAt,
    stateReference,
    traceId,
    userId: user.id,
  })

  return { data: { redirectTo } }
}
