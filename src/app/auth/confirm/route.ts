import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

import { getSafeNextPath } from "@/lib/auth/redirect"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

const emailOtpTypes = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup",
])

function loginError(request: Request) {
  const destination = new URL("/login", request.url)
  destination.searchParams.set("error", "auth_confirmation")
  return authRedirect(destination)
}

function authRedirect(destination: URL) {
  const response = NextResponse.redirect(destination)
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

function getSafeRedirectPath(requestUrl: URL) {
  const redirectTo = requestUrl.searchParams.get("redirect_to")

  if (!redirectTo) return undefined

  try {
    const destination = new URL(redirectTo, requestUrl.origin)

    if (destination.origin !== requestUrl.origin) return undefined

    return getSafeNextPath(
      `${destination.pathname}${destination.search}${destination.hash}`,
      undefined,
    )
  } catch {
    return undefined
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const tokenHash = requestUrl.searchParams.get("token_hash")
  const rawType = requestUrl.searchParams.get("type")

  if (
    !tokenHash ||
    !rawType ||
    !emailOtpTypes.has(rawType as EmailOtpType) ||
    !isSupabaseConfigured()
  ) {
    return loginError(request)
  }

  const type = rawType as EmailOtpType
  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  })

  if (error) {
    return loginError(request)
  }

  const nextPath = getSafeNextPath(
    requestUrl.searchParams.get("next") ?? getSafeRedirectPath(requestUrl),
    type === "recovery" ? "/reset-password" : undefined,
  )
  const destination = new URL(nextPath, request.url)

  if (type === "recovery") {
    destination.searchParams.set("recovery", "true")
  }

  return authRedirect(destination)
}
