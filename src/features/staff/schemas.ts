import { z } from "zod"

import { staffRoleCodes } from "./types"

const fullName = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(100, "Name must be 100 characters or fewer.")
  .regex(/\p{L}/u, "Enter a valid name.")

const email = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(254, "Email must be 254 characters or fewer.")
  .toLowerCase()

const phone = z
  .string()
  .trim()
  .max(32, "Phone number is too long.")
  .transform((value) => value.replace(/[\s().-]+/g, ""))
  .refine(
    (value) => !value || /^(?:\+[1-9][0-9]{7,14}|0[0-9]{7,14})$/.test(value),
    "Enter a valid phone number.",
  )
  .transform((value) => value || null)

const roleCode = z.enum(staffRoleCodes, {
  error: "Select a valid staff role.",
})

const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.")
  .regex(/[a-z]/, "Include at least one lowercase letter.")
  .regex(/[A-Z]/, "Include at least one uppercase letter.")
  .regex(/[0-9]/, "Include at least one number.")

export const inviteStaffSchema = z.object({
  action: z.literal("invite"),
  email,
  fullName,
  phone,
  roleCode,
})

export const resendStaffInvitationSchema = z.object({
  action: z.literal("resend"),
  invitationId: z.uuid("Select a valid staff invitation."),
})

export const revokeStaffInvitationSchema = z.object({
  action: z.literal("revoke"),
  invitationId: z.uuid("Select a valid staff invitation."),
})

export const updateStaffMemberSchema = z.object({
  action: z.literal("update"),
  memberId: z.uuid("Select a valid staff member."),
  roleCode,
  status: z.enum(["active", "suspended"], {
    error: "Select a valid staff status.",
  }),
})

export const staffMutationSchema = z.discriminatedUnion("action", [
  inviteStaffSchema,
  resendStaffInvitationSchema,
  revokeStaffInvitationSchema,
  updateStaffMemberSchema,
])

export const acceptStaffInvitationSchema = z
  .object({
    confirmPassword: z.string().optional(),
    fullName,
    invitationId: z.uuid("This staff invitation is invalid."),
    password: password.optional(),
    phone,
  })
  .refine(
    (value) => value.password === undefined
      || value.password === value.confirmPassword,
    { message: "Passwords do not match.", path: ["confirmPassword"] },
  )

export type AcceptStaffInvitationInput = z.output<
  typeof acceptStaffInvitationSchema
>
export type InviteStaffInput = z.output<typeof inviteStaffSchema>
export type StaffMutationInput = z.output<typeof staffMutationSchema>
