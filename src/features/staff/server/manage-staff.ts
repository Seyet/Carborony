import "server-only"

import { revalidatePath } from "next/cache"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { getCurrentUser } from "@/lib/auth/session"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { createClient } from "@/lib/supabase/server"
import type {
  AcceptStaffInvitationData,
  StaffMutationData,
} from "../api-types"
import type {
  AcceptStaffInvitationInput,
  StaffMutationInput,
} from "../schemas"
import { getMyStaffInvitation } from "./get-staff"
import { sendStaffInvitationEmail } from "./send-staff-invitation"

const safeDatabaseMessages = new Set([
  "A pending invitation already exists for this email.",
  "Enter a valid phone number.",
  "Enter a valid staff email address.",
  "Enter a valid staff phone number.",
  "Only the owner can invite an administrator.",
  "Only the owner can manage administrators.",
  "Ownership can only be changed through ownership transfer.",
  "Select a valid staff role.",
  "Select a valid staff status.",
  "Staff name must be between 2 and 100 characters.",
  "The business owner cannot accept a staff role.",
  "This email already belongs to a staff member.",
  "This invitation can no longer be resent.",
  "This invitation can no longer be revoked.",
  "This invitation has expired. Ask the owner to resend it.",
  "This invitation is no longer available.",
  "This invitation does not belong to your account.",
  "This staff member could not be found.",
  "You cannot suspend your own account.",
  "Your name must be between 2 and 100 characters.",
])

type StaffDatabaseError = {
  code: string
  details?: string | null
  hint?: string | null
  message: string
}

function staffDatabaseError(error: StaffDatabaseError): never {
  console.error("Staff database operation failed", {
    code: error.code,
    details: error.details ?? null,
    hint: error.hint ?? null,
    message: error.message,
  })

  if (error.code === "42501") {
    throw new ApiError(403, "STAFF_FORBIDDEN", error.message)
  }
  if (error.code === "P0001" || safeDatabaseMessages.has(error.message)) {
    throw new ApiError(422, "STAFF_INVALID", error.message)
  }
  if (error.code === "23505") {
    throw new ApiError(
      409,
      "STAFF_ALREADY_EXISTS",
      "This employee or invitation already exists.",
    )
  }
  if (["42702", "42703", "PGRST202", "PGRST204", "PGRST205"].includes(error.code)) {
    throw new ApiError(
      503,
      "STAFF_SETUP_REQUIRED",
      "Apply the staff management migration first.",
    )
  }

  const developmentDetails = process.env.NODE_ENV === "development"
    ? ` (${error.code || "DATABASE_ERROR"}: ${error.message})`
    : ""

  throw new ApiError(
    503,
    "STAFF_OPERATION_FAILED",
    `We couldn't update staff management. Please try again.${developmentDetails}`,
  )
}

async function inviteStaff(
  input: Extract<StaffMutationInput, { action: "invite" }>,
  origin: string,
): Promise<JsonHandlerResult<StaffMutationData>> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const invitationId = crypto.randomUUID()
  const { data, error } = await supabase.rpc("create_staff_invitation", {
    invited_email: input.email,
    invited_name: input.fullName,
    invited_phone: input.phone,
    invited_role_code: input.roleCode,
    target_business_id: business.id,
    target_invitation_id: invitationId,
  }).single()

  if (error) staffDatabaseError(error)
  if (!data) throw new ApiError(503, "STAFF_OPERATION_FAILED", "The invitation could not be created.")

  try {
    await sendStaffInvitationEmail({
      businessName: data.business_name,
      email: input.email,
      fullName: input.fullName,
      invitationId: data.invitation_id,
      phone: input.phone,
      roleName: data.role_name,
    }, origin)
  } catch (emailError) {
    const { error: revokeError } = await supabase.rpc(
      "revoke_staff_invitation",
      {
        target_business_id: business.id,
        target_invitation_id: data.invitation_id,
      },
    )
    if (revokeError) {
      console.error("Failed to revoke an undelivered staff invitation", revokeError)
    }
    throw emailError
  }

  revalidatePath("/app/staff")
  return {
    data: { id: data.invitation_id },
    message: `Invitation sent to ${input.email}.`,
    status: 201,
  }
}

async function resendInvitation(
  input: Extract<StaffMutationInput, { action: "resend" }>,
  origin: string,
): Promise<JsonHandlerResult<StaffMutationData>> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(
    "prepare_staff_invitation_resend",
    {
      target_business_id: business.id,
      target_invitation_id: input.invitationId,
    },
  ).single()
  if (error) staffDatabaseError(error)
  if (!data) throw new ApiError(404, "STAFF_INVITE_NOT_FOUND", "This invitation could not be found.")

  await sendStaffInvitationEmail({
    businessName: data.business_name,
    email: data.invited_email,
    fullName: data.invited_name,
    invitationId: data.invitation_id,
    phone: data.invited_phone,
    roleName: data.role_name,
  }, origin)

  revalidatePath("/app/staff")
  return {
    data: { id: data.invitation_id },
    message: `A new invitation was sent to ${data.invited_email}.`,
  }
}

async function revokeInvitation(
  input: Extract<StaffMutationInput, { action: "revoke" }>,
): Promise<JsonHandlerResult<StaffMutationData>> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("revoke_staff_invitation", {
    target_business_id: business.id,
    target_invitation_id: input.invitationId,
  })
  if (error) staffDatabaseError(error)
  if (!data) throw new ApiError(404, "STAFF_INVITE_NOT_FOUND", "This invitation could not be found.")
  revalidatePath("/app/staff")
  return { data: { id: input.invitationId }, message: "Invitation revoked." }
}

async function updateMember(
  input: Extract<StaffMutationInput, { action: "update" }>,
): Promise<JsonHandlerResult<StaffMutationData>> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("update_business_staff_member", {
    requested_role_code: input.roleCode,
    requested_status: input.status,
    target_business_id: business.id,
    target_member_id: input.memberId,
  })
  if (error) staffDatabaseError(error)
  if (!data) throw new ApiError(404, "STAFF_MEMBER_NOT_FOUND", "This staff member could not be found.")
  revalidatePath("/app/staff")
  return {
    data: { id: input.memberId },
    message: input.status === "suspended"
      ? "Staff access suspended."
      : "Staff member updated.",
  }
}

export async function manageStaff(
  input: StaffMutationInput,
  origin: string,
) {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to manage staff.")

  if (input.action === "invite") return inviteStaff(input, origin)
  if (input.action === "resend") return resendInvitation(input, origin)
  if (input.action === "revoke") return revokeInvitation(input)
  return updateMember(input)
}

export async function acceptStaffInvitation(
  input: AcceptStaffInvitationInput,
  responseHeaders: Headers,
): Promise<JsonHandlerResult<AcceptStaffInvitationData>> {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to accept this invitation.")

  const invitation = await getMyStaffInvitation(input.invitationId)
  if (!invitation) {
    throw new ApiError(404, "STAFF_INVITE_NOT_FOUND", "This invitation is unavailable for your account.")
  }
  if (invitation.status !== "pending") {
    throw new ApiError(422, "STAFF_INVITE_UNAVAILABLE", invitation.status === "expired"
      ? "This invitation has expired. Ask the owner to resend it."
      : "This invitation is no longer available.")
  }
  if (invitation.requiresPassword && !input.password) {
    throw new ApiError(422, "PASSWORD_REQUIRED", "Create a password to accept this invitation.")
  }

  const supabase = await createClient({
    responseHeaders,
    strictCookieWrites: true,
  })
  if (input.password) {
    const { error: passwordError } = await supabase.auth.updateUser({
      data: {
        carborony_password_configured: true,
        full_name: input.fullName,
        phone: input.phone,
      },
      password: input.password,
    })
    if (passwordError) {
      throw new ApiError(
        passwordError.code === "weak_password" ? 422 : 503,
        passwordError.code === "weak_password" ? "WEAK_PASSWORD" : "PASSWORD_UPDATE_FAILED",
        passwordError.code === "weak_password"
          ? "Choose a stronger password and try again."
          : "We couldn't set your password. Please try again.",
      )
    }
  }

  const { data, error } = await supabase.rpc("accept_staff_invitation", {
    accepted_name: input.fullName,
    accepted_phone: input.phone,
    target_invitation_id: input.invitationId,
  }).single()
  if (error) staffDatabaseError(error)
  if (!data) throw new ApiError(503, "STAFF_ACCEPT_FAILED", "The invitation could not be accepted.")

  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  responseHeaders.append(
    "Set-Cookie",
    `carborony-business=${encodeURIComponent(data.business_id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
  )

  revalidatePath("/app")
  return {
    data: {
      businessId: data.business_id,
      redirectTo: "/app/dashboard?invitation=accepted",
    },
    message: `You joined ${data.business_name} as ${data.role_name}.`,
  }
}
