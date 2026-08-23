import "server-only"

import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

import {
  getSupabaseEnvironment,
  isSupabaseConfigured,
} from "@/lib/supabase/env"
import type { Database } from "@/types/database"

const authRoutes = new Set([
  "/forgot-password",
  "/login",
  "/register",
  "/verify-otp",
])

function copyCookies(source: NextResponse, destination: NextResponse) {
  source.cookies.getAll().forEach((cookie) => destination.cookies.set(cookie))

  for (const header of ["cache-control", "expires", "pragma"] as const) {
    const value = source.headers.get(header)
    if (value) destination.headers.set(header, value)
  }

  return destination
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const { pathname, search } = request.nextUrl

  // Keep setup and public auth screens available before a project is linked,
  // but never allow an unconfigured deployment into authenticated routes.
  if (!isSupabaseConfigured()) {
    if (pathname.startsWith("/app") || pathname.startsWith("/onboarding")) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("next", `${pathname}${search}`)
      return NextResponse.redirect(loginUrl)
    }

    return response
  }

  const { anonKey, url } = getSupabaseEnvironment()

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headersToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })

        response = NextResponse.next({ request })

        cookiesToSet.forEach(({ name, options, value }) => {
          response.cookies.set(name, value, options)
        })

        Object.entries(headersToSet).forEach(([name, value]) => {
          response.headers.set(name, value)
        })
      },
    },
  })

  // getClaims verifies the token and refreshes an expiring session when needed.
  const { data } = await supabase.auth.getClaims()
  const isAuthenticated = Boolean(data?.claims.sub)

  if ((pathname.startsWith("/app") || pathname.startsWith("/onboarding")) && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", `${pathname}${search}`)

    return copyCookies(response, NextResponse.redirect(loginUrl))
  }

  if (authRoutes.has(pathname) && isAuthenticated) {
    return copyCookies(
      response,
      NextResponse.redirect(new URL("/app/dashboard", request.url)),
    )
  }

  return response
}
