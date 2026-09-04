import { type NextRequest, NextResponse } from "next/server"

import { accessTokenFingerprint } from "@/features/instagram/server/config"
import { hashInstagramOAuthState } from "@/features/instagram/server/connect-instagram"
import {
  logInstagramError,
  logInstagramInfo,
  logInstagramWarning,
  newInstagramTraceId,
} from "@/features/instagram/server/logger"
import {
  exchangeAuthorizationCode,
  exchangeLongLivedToken,
  getInstagramProfile,
} from "@/features/instagram/server/meta-client"
import { encryptInstagramToken } from "@/features/instagram/server/token-vault"
import { getCurrentUser } from "@/lib/auth/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function safeReturnPath(value: string | null | undefined) {
  return value?.startsWith("/app/") && !value.startsWith("//")
    ? value
    : "/app/settings?section=integrations"
}

function resultRedirect(request: NextRequest, returnPath: string, result: string) {
  const url = new URL(safeReturnPath(returnPath), request.url)
  url.searchParams.set("instagram", result)
  const response = NextResponse.redirect(url, 303)
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

function failureResultForStage(stage: string) {
  switch (stage) {
    case "short_token_exchange":
      return "code_exchange_failed"
    case "long_token_exchange":
      return "token_exchange_failed"
    case "profile_lookup":
      return "profile_lookup_failed"
    case "token_encryption":
      return "server_configuration_failed"
    case "connection_save":
      return "save_failed"
    default:
      return "connection_failed"
  }
}

export async function GET(request: NextRequest) {
  const traceId = newInstagramTraceId()
  const startedAt = Date.now()
  const state = request.nextUrl.searchParams.get("state")
  const code = request.nextUrl.searchParams.get("code")
  const denied = request.nextUrl.searchParams.has("error")
  const stateReference = state && state.length <= 256
    ? hashInstagramOAuthState(state).slice(0, 12)
    : undefined

  logInstagramInfo("oauth.callback_received", {
    authorizationDenied: denied,
    hasCode: Boolean(code),
    hasState: Boolean(state),
    stateReference,
    traceId,
  })

  if (!state || state.length > 256) {
    logInstagramWarning("oauth.callback_rejected", {
      durationMs: Date.now() - startedAt,
      reason: "invalid_state_format",
      traceId,
    })
    return resultRedirect(request, "/app/settings?section=integrations", "invalid_state")
  }

  const user = await getCurrentUser()
  if (!user) {
    logInstagramWarning("oauth.callback_rejected", {
      durationMs: Date.now() - startedAt,
      reason: "auth_required",
      stateReference,
      traceId,
    })
    const login = new URL("/login", request.url)
    login.searchParams.set("next", "/app/settings?section=integrations")
    return NextResponse.redirect(login, 303)
  }

  const supabase = await createClient()
  const { data: stateRows, error: stateError } = await supabase.rpc(
    "consume_instagram_oauth_state",
    { target_state_hash: hashInstagramOAuthState(state) },
  )
  const savedState = stateRows?.[0]

  if (stateError || !savedState) {
    if (stateError) {
      logInstagramError("oauth.state_consumption_failed", stateError, {
        durationMs: Date.now() - startedAt,
        stateReference,
        traceId,
        userId: user.id,
      })
    } else {
      logInstagramWarning("oauth.callback_rejected", {
        durationMs: Date.now() - startedAt,
        reason: "state_expired_or_used",
        stateReference,
        traceId,
        userId: user.id,
      })
    }
    return resultRedirect(request, "/app/settings?section=integrations", "invalid_state")
  }
  const returnPath = safeReturnPath(savedState.return_path)
  if (denied || !code || code.length > 4_096) {
    logInstagramWarning("oauth.callback_rejected", {
      businessId: savedState.business_id,
      durationMs: Date.now() - startedAt,
      reason: denied ? "authorization_denied" : "missing_or_invalid_code",
      stateReference,
      traceId,
      userId: user.id,
    })
    return resultRedirect(request, returnPath, denied ? "cancelled" : "missing_code")
  }

  let stage = "short_token_exchange"
  let stageStartedAt = Date.now()

  try {
    logInstagramInfo("oauth.stage_started", {
      businessId: savedState.business_id,
      stage,
      stateReference,
      traceId,
      userId: user.id,
    })
    const shortLived = await exchangeAuthorizationCode(code, request.nextUrl.origin)
    logInstagramInfo("oauth.stage_completed", {
      businessId: savedState.business_id,
      durationMs: Date.now() - stageStartedAt,
      stage,
      stateReference,
      traceId,
      userId: user.id,
    })
    stage = "long_token_exchange"
    stageStartedAt = Date.now()
    logInstagramInfo("oauth.stage_started", {
      businessId: savedState.business_id,
      stage,
      stateReference,
      traceId,
      userId: user.id,
    })
    const longLived = await exchangeLongLivedToken(shortLived.access_token)
    logInstagramInfo("oauth.stage_completed", {
      businessId: savedState.business_id,
      durationMs: Date.now() - stageStartedAt,
      stage,
      stateReference,
      traceId,
      userId: user.id,
    })
    stage = "profile_lookup"
    stageStartedAt = Date.now()
    logInstagramInfo("oauth.stage_started", {
      businessId: savedState.business_id,
      stage,
      stateReference,
      traceId,
      userId: user.id,
    })
    const profile = await getInstagramProfile(longLived.access_token)
    logInstagramInfo("oauth.stage_completed", {
      businessId: savedState.business_id,
      durationMs: Date.now() - stageStartedAt,
      instagramAccountId: profile.user_id ?? profile.id,
      stage,
      stateReference,
      traceId,
      userId: user.id,
    })
    const expiresAt = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1_000).toISOString()
      : null
    stage = "token_encryption"
    stageStartedAt = Date.now()
    const encrypted = encryptInstagramToken(longLived.access_token)
    const accountType = profile.account_type?.toLocaleLowerCase("en") === "business"
      ? "business"
      : "creator"
    stage = "connection_save"
    stageStartedAt = Date.now()
    const admin = createAdminClient()
    const { error: connectionError } = await admin.rpc(
      "complete_instagram_connection",
      {
        encrypted_access_token: encrypted.ciphertext,
        instagram_account: {
          account_type: accountType,
          granted_scopes: ["instagram_business_basic"],
          instagram_user_id: profile.user_id ?? profile.id,
          username: profile.username,
        },
        target_business_id: savedState.business_id,
        target_connected_by: savedState.initiated_by,
        target_encryption_version: encrypted.version,
        target_token_expires_at: expiresAt,
        target_token_fingerprint: accessTokenFingerprint(longLived.access_token),
      },
    )

    if (connectionError) {
      logInstagramError("oauth.connection_save_failed", connectionError, {
        businessId: savedState.business_id,
        durationMs: Date.now() - stageStartedAt,
        instagramAccountId: profile.user_id ?? profile.id,
        stage,
        stateReference,
        traceId,
        userId: user.id,
      })
      return resultRedirect(request, returnPath, "save_failed")
    }

    logInstagramInfo("oauth.connection_completed", {
      businessId: savedState.business_id,
      durationMs: Date.now() - startedAt,
      instagramAccountId: profile.user_id ?? profile.id,
      stateReference,
      traceId,
      userId: user.id,
    })
    return resultRedirect(request, returnPath, "connected")
  } catch (error) {
    logInstagramError("oauth.callback_failed", error, {
      businessId: savedState.business_id,
      durationMs: Date.now() - startedAt,
      stage,
      stageDurationMs: Date.now() - stageStartedAt,
      stateReference,
      traceId,
      userId: user.id,
    })
    return resultRedirect(request, returnPath, failureResultForStage(stage))
  }
}
