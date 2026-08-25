import "server-only"

import {
  type AuthError,
  isAuthRetryableFetchError,
} from "@supabase/supabase-js"

import type {
  AuthRedirectData,
  ForgotPasswordData,
  RegistrationData,
  ResendSignupOtpData,
} from "@/features/auth/api-types"
import type {
  ForgotPasswordInput,
  LoginInput,
  RegistrationInput,
  ResendSignupOtpInput,
  ResetPasswordInput,
  VerifySignupOtpInput,
} from "@/features/auth/schemas"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { getSafeNextPath } from "@/lib/auth/redirect"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

const configurationMessage =
  "Authentication is unavailable because the service is not configured correctly."

function ensureConfigured() {
  if (!isSupabaseConfigured()) {
    throw new ApiError(503, "AUTH_UNAVAILABLE", configurationMessage)
  }
}

function isRateLimitError(error: AuthError) {
  return [
    "over_email_send_rate_limit",
    "over_request_rate_limit",
    "over_sms_send_rate_limit",
  ].includes(error.code ?? "")
}

function isProviderConfigurationError(error: AuthError) {
  return error.status === 401 && !error.code
}

function logProviderFailure(operation: string, error: AuthError) {
  console.error(`Supabase Auth ${operation} failed`, {
    code: error.code ?? "unknown",
    message: error.message.slice(0, 500),
    name: error.name,
    status: error.status ?? "unknown",
  })
}

function throwSharedProviderError(operation: string, error: AuthError): never {
  if (isProviderConfigurationError(error)) {
    logProviderFailure(operation, error)
    throw new ApiError(503, "AUTH_UNAVAILABLE", configurationMessage)
  }

  if (isRateLimitError(error)) {
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "Too many attempts. Please wait a moment and try again.",
    )
  }

  if (error.code === "email_address_not_authorized") {
    logProviderFailure(operation, error)
    throw new ApiError(
      503,
      "EMAIL_DELIVERY_UNAVAILABLE",
      "We couldn't deliver an authentication email to this address. Please contact support.",
    )
  }

  if (error.code === "request_timeout") {
    logProviderFailure(operation, error)
    throw new ApiError(
      503,
      "AUTH_UNAVAILABLE",
      "Authentication is temporarily unavailable. Please try again shortly.",
    )
  }

  logProviderFailure(operation, error)
  throw new ApiError(
    503,
    "AUTH_UNAVAILABLE",
    "Authentication is temporarily unavailable. Please try again shortly.",
  )
}

function throwOtpVerificationError(error: AuthError): never {
  if (isAuthRetryableFetchError(error)) {
    logProviderFailure("OTP verification", error)
    throw new ApiError(
      503,
      "OTP_PROVIDER_UNAVAILABLE",
      "Email verification is temporarily unavailable. Please retry in a moment.",
    )
  }

  if (
    [
      "bad_code_verifier",
      "flow_state_expired",
      "flow_state_not_found",
      "otp_expired",
      "user_not_found",
      "validation_failed",
    ].includes(error.code ?? "")
  ) {
    throw new ApiError(
      422,
      "INVALID_OTP",
      "That verification code is invalid or has expired.",
    )
  }

  if (error.code === "otp_disabled") {
    logProviderFailure("OTP verification", error)
    throw new ApiError(
      503,
      "OTP_UNAVAILABLE",
      "Email verification is temporarily unavailable. Please try again shortly.",
    )
  }

  throwSharedProviderError("OTP verification", error)
}

async function createAuthClient(responseHeaders: Headers) {
  ensureConfigured()
  return createClient({ responseHeaders, strictCookieWrites: true })
}

export async function login(
  input: LoginInput,
  responseHeaders: Headers,
): Promise<JsonHandlerResult<AuthRedirectData>> {
  const supabase = await createAuthClient(responseHeaders)
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })

  if (error) {
    if (error.code === "invalid_credentials") {
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Email or password is incorrect.",
      )
    }

    if (error.code === "email_not_confirmed") {
      throw new ApiError(
        403,
        "EMAIL_NOT_CONFIRMED",
        "Confirm your email address before signing in.",
      )
    }

    throwSharedProviderError("login", error)
  }

  return {
    data: { redirectTo: getSafeNextPath(input.next) },
    message: "Signed in successfully.",
  }
}

export async function register(
  input: RegistrationInput,
  origin: string,
  responseHeaders: Headers,
): Promise<JsonHandlerResult<RegistrationData>> {
  const callbackUrl = new URL("/auth/callback", origin)
  callbackUrl.searchParams.set("next", "/onboarding/business")

  const supabase = await createAuthClient(responseHeaders)
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    options: {
      data: {
        full_name: input.fullName,
      },
      emailRedirectTo: callbackUrl.toString(),
    },
    password: input.password,
  })

  if (error) {
    if (error.code === "weak_password") {
      throw new ApiError(
        422,
        "WEAK_PASSWORD",
        "Choose a stronger password and try again.",
      )
    }

    if (error.code === "email_address_invalid") {
      throw new ApiError(
        422,
        "INVALID_EMAIL",
        "Enter a valid email address.",
      )
    }

    if (error.code === "signup_disabled") {
      throw new ApiError(
        403,
        "SIGNUP_DISABLED",
        "New account registration is currently unavailable.",
      )
    }

    if (error.code === "user_already_exists") {
      throw new ApiError(
        409,
        "ACCOUNT_EXISTS",
        "An account with this email already exists. Sign in instead.",
      )
    }

    throwSharedProviderError("registration", error)
  }

  if (data.session) {
    console.error(
      "Supabase Auth registration returned a session before email verification. Enable Confirm Email for the required OTP flow.",
    )
    await supabase.auth.signOut({ scope: "local" })

    throw new ApiError(
      503,
      "EMAIL_CONFIRMATION_REQUIRED",
      "Account verification is not configured correctly. Please contact support.",
    )
  }

  return {
    data: {
      email: input.email,
      redirectTo: "/verify-otp",
    },
    message: "We sent a verification code to your email address.",
    status: 201,
  }
}

export async function verifySignupOtp(
  input: VerifySignupOtpInput,
  responseHeaders: Headers,
): Promise<JsonHandlerResult<AuthRedirectData>> {
  const supabase = await createAuthClient(responseHeaders)
  const { data, error } = await supabase.auth.verifyOtp({
    email: input.email,
    token: input.token,
    type: "email",
  })

  if (error) throwOtpVerificationError(error)

  if (!data.session || !data.user) {
    throw new ApiError(
      401,
      "OTP_VERIFICATION_FAILED",
      "We couldn't verify that code. Request a new code and try again.",
    )
  }

  return {
    data: { redirectTo: "/onboarding/business" },
    message: "Email verified successfully.",
  }
}

export async function resendSignupOtp(
  input: ResendSignupOtpInput,
  origin: string,
  responseHeaders: Headers,
): Promise<JsonHandlerResult<ResendSignupOtpData>> {
  const callbackUrl = new URL("/auth/callback", origin)
  callbackUrl.searchParams.set("next", "/onboarding/business")

  const supabase = await createAuthClient(responseHeaders)
  const { error } = await supabase.auth.resend({
    email: input.email,
    options: { emailRedirectTo: callbackUrl.toString() },
    type: "signup",
  })

  if (error?.code === "user_not_found") {
    return {
      data: { accepted: true },
      message: "If that signup is still pending, a new code has been sent.",
    }
  }

  if (error) throwSharedProviderError("OTP resend", error)

  return {
    data: { accepted: true },
    message: "A new verification code has been sent.",
  }
}

export async function forgotPassword(
  input: ForgotPasswordInput,
  origin: string,
  responseHeaders: Headers,
): Promise<JsonHandlerResult<ForgotPasswordData>> {
  const callbackUrl = new URL("/auth/callback", origin)
  callbackUrl.searchParams.set("flow", "recovery")
  callbackUrl.searchParams.set("next", "/reset-password")

  const supabase = await createAuthClient(responseHeaders)
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: callbackUrl.toString(),
  })

  if (error) throwSharedProviderError("password recovery", error)

  return {
    data: { accepted: true },
    message:
      "If an account exists for that email, you'll receive reset instructions shortly.",
  }
}

export async function resetPassword(
  input: ResetPasswordInput,
  responseHeaders: Headers,
): Promise<JsonHandlerResult<AuthRedirectData>> {
  const supabase = await createAuthClient(responseHeaders)
  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser()

  if (sessionError && isProviderConfigurationError(sessionError)) {
    throwSharedProviderError("recovery session verification", sessionError)
  }

  if (sessionError || !user) {
    throw new ApiError(
      401,
      "RECOVERY_SESSION_EXPIRED",
      "This recovery session has expired. Request a new reset link.",
    )
  }

  const { error } = await supabase.auth.updateUser({
    data: { carborony_password_configured: true },
    password: input.password,
  })

  if (error) throwSharedProviderError("password update", error)

  await supabase.auth.signOut({ scope: "local" })

  return {
    data: { redirectTo: "/login?reset=success" },
    message: "Your password has been updated.",
  }
}

export async function logout(
  responseHeaders: Headers,
): Promise<JsonHandlerResult<AuthRedirectData>> {
  const supabase = await createAuthClient(responseHeaders)

  // Supabase revokes the current refresh token and the SSR client emits
  // expired Set-Cookie headers, removing the session tokens from this device.
  const { error } = await supabase.auth.signOut({ scope: "local" })

  if (error && !["session_not_found", "refresh_token_not_found"].includes(error.code ?? "")) {
    throwSharedProviderError("logout", error)
  }

  return {
    data: { redirectTo: "/login" },
    message: "Signed out successfully.",
  }
}
