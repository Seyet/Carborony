import { z } from "zod"

const email = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.")
  .max(254, "Email is too long.")
  .toLowerCase()

const fullName = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(100, "Name must be 100 characters or fewer.")
  .regex(/\p{L}/u, "Enter your full name.")

const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.")
  .regex(/[a-z]/, "Include at least one lowercase letter.")
  .regex(/[A-Z]/, "Include at least one uppercase letter.")
  .regex(/[0-9]/, "Include at least one number.")

export const loginSchema = z.object({
  email,
  next: z.string().optional(),
  password: z.string().min(1, "Password is required."),
})

export const registrationSchema = z.object({
  email,
  fullName,
  password,
})

export const verifySignupOtpSchema = z.object({
  email,
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit verification code."),
})

export const resendSignupOtpSchema = z.object({ email })

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({
    confirmPassword: z.string().min(1, "Confirm your password."),
    password,
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })

export const logoutSchema = z.object({
  intent: z.literal("logout").default("logout"),
})

export type ForgotPasswordInput = z.output<typeof forgotPasswordSchema>
export type LoginInput = z.output<typeof loginSchema>
export type LogoutInput = z.output<typeof logoutSchema>
export type RegistrationInput = z.output<typeof registrationSchema>
export type ResendSignupOtpInput = z.output<typeof resendSignupOtpSchema>
export type ResetPasswordInput = z.output<typeof resetPasswordSchema>
export type VerifySignupOtpInput = z.output<typeof verifySignupOtpSchema>
