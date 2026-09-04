import { type NextRequest, NextResponse } from "next/server"

import { accessTokenFingerprint } from "@/features/instagram/server/config"
import { hashInstagramOAuthState } from "@/features/instagram/server/connect-instagram"
import {
  exchangeAuthorizationCode,
  exchangeLongLivedToken,
  getInstagramProfile,
  MetaInstagramError,
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
  const state = request.nextUrl.searchParams.get("state")
  const code = request.nextUrl.searchParams.get("code")
  const denied = request.nextUrl.searchParams.has("error")

  if (!state || state.length > 256) {
    return resultRedirect(request, "/app/settings?section=integrations", "invalid_state")
  }

  const user = await getCurrentUser()
  if (!user) {
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
    return resultRedirect(request, "/app/settings?section=integrations", "invalid_state")
  }
  const returnPath = safeReturnPath(savedState.return_path)
  if (denied || !code || code.length > 4_096) {
    return resultRedirect(request, returnPath, denied ? "cancelled" : "missing_code")
  }

  let stage = "short_token_exchange"

  try {
    const shortLived = await exchangeAuthorizationCode(code, request.nextUrl.origin)
    stage = "long_token_exchange"
    const longLived = await exchangeLongLivedToken(shortLived.access_token)
    stage = "profile_lookup"
    const profile = await getInstagramProfile(longLived.access_token)
    const expiresAt = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1_000).toISOString()
      : null
    stage = "token_encryption"
    const encrypted = encryptInstagramToken(longLived.access_token)
    const accountType = profile.account_type?.toLocaleLowerCase("en") === "business"
      ? "business"
      : "creator"
    stage = "connection_save"
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
      console.error("Instagram connection save failed", {
        code: connectionError.code,
        message: connectionError.message,
      })
      return resultRedirect(request, returnPath, "save_failed")
    }

    return resultRedirect(request, returnPath, "connected")
  } catch (error) {
    console.error("Instagram OAuth callback failed", {
      stage,
      name: error instanceof Error ? error.name : "UnknownError",
      status: error instanceof MetaInstagramError ? error.status : undefined,
      metaCode: error instanceof MetaInstagramError ? error.metaCode : undefined,
      metaSubcode: error instanceof MetaInstagramError ? error.metaSubcode : undefined,
    })
    return resultRedirect(request, returnPath, failureResultForStage(stage))
  }
}
