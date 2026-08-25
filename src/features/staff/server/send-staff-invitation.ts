import "server-only"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import { ApiError } from "@/lib/api/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSupabaseEnvironment } from "@/lib/supabase/env"

type StaffInvitationEmail = {
  businessName: string
  email: string
  fullName: string
  invitationId: string
  phone: string | null
  roleName: string
}

function isExistingAccountError(error: { code?: string; message: string }) {
  const message = error.message.toLowerCase()
  return ["email_exists", "user_already_exists"].includes(error.code ?? "")
    || message.includes("already been registered")
    || message.includes("already exists")
}

function invitationDestination(origin: string, invitationId: string) {
  const destination = new URL(`/staff/invitations/${invitationId}`, origin)
  return destination.toString()
}

/**
 * New accounts receive Supabase's Invite User template. Existing accounts
 * receive its Magic Link template and keep their current password.
 */
export async function sendStaffInvitationEmail(
  invitation: StaffInvitationEmail,
  origin: string,
) {
  const redirectTo = invitationDestination(origin, invitation.invitationId)
  let admin

  try {
    admin = createAdminClient()
  } catch (error) {
    console.error("Staff invitation admin client is unavailable", error)
    throw new ApiError(
      503,
      "STAFF_EMAIL_NOT_CONFIGURED",
      "Staff invitation email is not configured. Add the Supabase project secret key.",
    )
  }

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    invitation.email,
    {
      data: {
        business_name: invitation.businessName,
        full_name: invitation.fullName,
        phone: invitation.phone,
        role_name: invitation.roleName,
        staff_invitation_id: invitation.invitationId,
      },
      redirectTo,
    },
  )

  if (!inviteError) return "invite" as const

  if (!isExistingAccountError(inviteError)) {
    console.error("Supabase staff invitation email failed", {
      code: inviteError.code ?? "unknown",
      message: inviteError.message.slice(0, 500),
      status: inviteError.status ?? "unknown",
    })
    throw new ApiError(
      inviteError.status === 429 ? 429 : 503,
      inviteError.status === 429 ? "STAFF_INVITE_RATE_LIMITED" : "STAFF_EMAIL_FAILED",
      inviteError.status === 429
        ? "Too many invitation emails were sent. Wait a moment and try again."
        : "We couldn't send the staff invitation email. Please try again.",
    )
  }

  const { anonKey, url } = getSupabaseEnvironment()
  const authClient = createSupabaseClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
  const { error: magicLinkError } = await authClient.auth.signInWithOtp({
    email: invitation.email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: false,
    },
  })

  if (magicLinkError) {
    console.error("Existing staff account magic-link email failed", {
      code: magicLinkError.code ?? "unknown",
      message: magicLinkError.message.slice(0, 500),
      status: magicLinkError.status ?? "unknown",
    })
    throw new ApiError(
      magicLinkError.status === 429 ? 429 : 503,
      magicLinkError.status === 429 ? "STAFF_INVITE_RATE_LIMITED" : "STAFF_EMAIL_FAILED",
      magicLinkError.status === 429
        ? "Too many invitation emails were sent. Wait a moment and try again."
        : "We couldn't send the staff invitation email. Please try again.",
    )
  }

  return "magiclink" as const
}
