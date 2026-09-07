import "server-only"

import { isAuthRetryableFetchError, type User } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { cache } from "react"

import { createClient } from "@/lib/supabase/server"
import { ApiError } from "@/lib/api/server"

/** Returns the verified Supabase user for the current request, if present. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error && (isAuthRetryableFetchError(error) || error.status === 0
    || error.status === 429 || (error.status !== undefined && error.status >= 500))) {
    console.error("Supabase session verification unavailable", {
      name: error.name, code: error.code, status: error.status,
    })
    const rateLimited = error.status === 429
    throw new ApiError(rateLimited ? 429 : 503,
      rateLimited ? "AUTH_RATE_LIMITED" : "AUTH_UNAVAILABLE",
      rateLimited ? "Too many authentication requests. Please wait a moment and try again."
        : "We couldn't verify your session right now. Please try again shortly.")
  }

  if (error || !user) {
    return null
  }

  return user
})

/**
 * Secure server-side route/data guard. Proxy improves navigation UX, while
 * this verified Auth API lookup remains the authorization boundary.
 */
export const requireUser = cache(async (): Promise<User> => {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return user
})
