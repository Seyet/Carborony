import "server-only"

import { cache } from "react"

import { requireUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export type CurrentBusiness = {
  id: string
  name: string
  onboardingCompletedAt: string | null
  roleName: string
}

/**
 * Returns the authenticated user's primary business membership.
 *
 * Business switching is intentionally deferred. Until an active-business
 * preference exists, the user's earliest membership is their current business.
 */
export const getCurrentBusinessOrNull = cache(
  async (): Promise<CurrentBusiness | null> => {
    const user = await requireUser()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("business_members")
      .select(
        `
          business:businesses!business_members_business_id_fkey!inner(
            id,
            name,
            onboarding_completed_at
          ),
          role:roles!business_members_role_id_fkey!inner(name)
        `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new Error("Unable to load the current business.", { cause: error })
    }

    if (!data?.business || !data.role) return null

    return {
      id: data.business.id,
      name: data.business.name,
      onboardingCompletedAt: data.business.onboarding_completed_at,
      roleName: data.role.name,
    }
  }
)

export const getCurrentBusiness = cache(async (): Promise<CurrentBusiness> => {
  const business = await getCurrentBusinessOrNull()
  if (!business) throw new Error("No business membership exists for the authenticated user.")
  return business
})
