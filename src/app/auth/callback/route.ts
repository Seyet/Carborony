import { NextResponse } from "next/server"

import { getSafeNextPath } from "@/lib/auth/redirect"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

function loginError(request: Request) {
  const destination = new URL("/login", request.url)
  destination.searchParams.set("error", "auth_callback")
  return authRedirect(destination)
}

function authRedirect(destination: URL) {
  const response = NextResponse.redirect(destination)
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")

  if (!code || !isSupabaseConfigured()) {
    return loginError(request)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return loginError(request)
  }

  const isRecovery = requestUrl.searchParams.get("flow") === "recovery"
  const nextPath = getSafeNextPath(
    requestUrl.searchParams.get("next"),
    isRecovery ? "/reset-password" : undefined,
  )
  const destination = new URL(nextPath, request.url)

  if (isRecovery) {
    destination.searchParams.set("recovery", "true")
  }

  return authRedirect(destination)
}
