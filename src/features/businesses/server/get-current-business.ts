import "server-only"

import { cache } from "react"
import { cookies } from "next/headers"

import { requireUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export type CurrentBusiness = {
  id: string
  name: string
  onboardingCompletedAt: string | null
  permissions: string[]
  roleCode: string
  roleName: string
}

const allPermissions = [
  "activity.view", "customers.manage", "customers.view", "dashboard.view",
  "expenses.manage", "expenses.view", "inventory.manage", "inventory.view",
  "products.manage", "products.view", "reports.export", "reports.view",
  "sales.manage", "sales.view", "settings.manage", "settings.view",
  "staff.manage", "staff.view",
]

const legacyRolePermissions: Record<string, string[]> = {
  admin: allPermissions,
  manager: allPermissions.filter((permission) =>
    !permission.startsWith("staff.") && !permission.startsWith("settings."),
  ),
  owner: allPermissions,
  staff: [
    "customers.manage", "customers.view", "dashboard.view",
    "products.view", "sales.manage", "sales.view",
  ],
}

function staffSchemaIsMissing(error: { code?: string; message: string } | null) {
  if (!error) return false
  return ["42703", "PGRST202", "PGRST204", "PGRST205"].includes(error.code ?? "")
    || error.message.includes("business_members.status")
}

/**
 * Returns the authenticated user's preferred active business membership,
 * falling back to their earliest active membership.
 */
export const getCurrentBusinessOrNull = cache(
  async (): Promise<CurrentBusiness | null> => {
    const user = await requireUser()
    const supabase = await createClient()
    const cookieStore = await cookies()
    const preferredBusinessId = cookieStore.get("carborony-business")?.value

    let { data: memberships, error } = await supabase
      .from("business_members")
      .select(
        `
          business:businesses!business_members_business_id_fkey!inner(
            id,
            name,
            onboarding_completed_at
          ),
          role:roles!business_members_role_id_fkey!inner(code, name)
        `
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })

    const usesLegacyStaffSchema = staffSchemaIsMissing(error)

    if (usesLegacyStaffSchema) {
      const fallback = await supabase
        .from("business_members")
        .select(
          `
            business:businesses!business_members_business_id_fkey!inner(
              id,
              name,
              onboarding_completed_at
            ),
            role:roles!business_members_role_id_fkey!inner(code, name)
          `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })

      memberships = fallback.data
      error = fallback.error
    }

    if (error) {
      throw new Error("Unable to load the current business.", { cause: error })
    }

    const data = memberships?.find(
      (membership) => membership.business.id === preferredBusinessId,
    ) ?? memberships?.[0]

    if (!data?.business || !data.role) return null

    const permissionResult = usesLegacyStaffSchema
      ? null
      : await supabase.rpc(
          "get_my_business_permissions",
          { target_business_id: data.business.id },
        )
    const permissionRows = permissionResult?.data ?? null
    const permissionsError = permissionResult?.error ?? null

    if (permissionsError && !staffSchemaIsMissing(permissionsError)) {
      throw new Error("Unable to load business permissions.", {
        cause: permissionsError,
      })
    }

    return {
      id: data.business.id,
      name: data.business.name,
      onboardingCompletedAt: data.business.onboarding_completed_at,
      permissions: permissionRows
        ? permissionRows.map((row) => row.permission_code)
        : (legacyRolePermissions[data.role.code] ?? []),
      roleCode: data.role.code,
      roleName: data.role.name,
    }
  }
)

export const getCurrentBusiness = cache(async (): Promise<CurrentBusiness> => {
  const business = await getCurrentBusinessOrNull()
  if (!business) throw new Error("No business membership exists for the authenticated user.")
  return business
})
