import "server-only"

import type { User } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

/** Returns the verified Supabase user for the current request, if present. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

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
