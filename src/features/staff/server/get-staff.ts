import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { createClient } from "@/lib/supabase/server"
import type {
  MyStaffInvitation,
  StaffPageData,
  StaffRecordStatus,
  StaffRoleCode,
} from "../types"

const setupErrorCodes = new Set([
  "42703",
  "PGRST202",
  "PGRST204",
  "PGRST205",
])

export class StaffSetupRequiredError extends Error {}
export class StaffAccessDeniedError extends Error {}

export async function getStaffPageData(): Promise<StaffPageData> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const [recordsResult, rolesResult] = await Promise.all([
    supabase.rpc("get_staff_management", {
      target_business_id: business.id,
    }),
    supabase.rpc("get_staff_role_options", {
      target_business_id: business.id,
    }),
  ])

  const error = recordsResult.error ?? rolesResult.error
  if (error) {
    if (setupErrorCodes.has(error.code)) throw new StaffSetupRequiredError()
    if (error.code === "42501") throw new StaffAccessDeniedError()
    throw new Error("Unable to load staff management.", { cause: error })
  }

  return {
    businessId: business.id,
    businessName: business.name,
    canInviteAdmin: business.roleCode === "owner",
    records: (recordsResult.data ?? []).map((record) => ({
      email: record.email,
      expiresAt: record.expires_at,
      fullName: record.full_name,
      id: record.record_id,
      invitedAt: record.invited_at,
      isCurrentUser: record.is_current_user,
      joinedAt: record.joined_at,
      kind: record.record_kind === "member" ? "member" : "invitation",
      phone: record.phone,
      roleCode: record.role_code,
      roleName: record.role_name,
      status: record.status as StaffRecordStatus,
      userId: record.user_id,
    })),
    roles: (rolesResult.data ?? [])
      .filter((role) => business.roleCode === "owner" || role.role_code !== "admin")
      .map((role) => ({
        code: role.role_code as StaffRoleCode,
        description: role.role_description,
        name: role.role_name,
        permissions: role.permission_codes,
      })),
  }
}

export async function getMyStaffInvitation(
  invitationId: string,
): Promise<MyStaffInvitation | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_my_staff_invitation", {
    target_invitation_id: invitationId,
  }).maybeSingle()

  if (error) {
    if (setupErrorCodes.has(error.code)) throw new StaffSetupRequiredError()
    if (error.code === "42501") return null
    throw new Error("Unable to load this staff invitation.", { cause: error })
  }
  if (!data) return null

  return {
    businessId: data.business_id,
    businessName: data.business_name,
    email: data.email,
    expiresAt: data.expires_at,
    fullName: data.full_name,
    id: data.invitation_id,
    permissions: data.permission_codes,
    phone: data.phone,
    requiresPassword: data.requires_password,
    roleCode: data.role_code,
    roleName: data.role_name,
    status: data.status,
  }
}
