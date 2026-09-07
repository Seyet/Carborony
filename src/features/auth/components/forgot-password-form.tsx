"use client"

import { type FormEvent, useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import type { AuthRedirectData, ForgotPasswordData } from "@/features/auth/api-types"
import { FormField } from "@/features/auth/components/form-field"
import { SubmitButton } from "@/features/auth/components/submit-button"
import { forgotPasswordSchema, verifyRecoveryOtpSchema } from "@/features/auth/schemas"
import { useFormValidation } from "@/features/auth/use-form-validation"
import { postJson } from "@/lib/api/client"

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState<string | null>(null)
  const [resendPending, setResendPending] = useState(false)
  const [resendCoolingDown, setResendCoolingDown] = useState(false)
  const {
    getFieldProps,
    isValid,
    validateForSubmit,
    values,
  } = useFormValidation(
    forgotPasswordSchema,
    { email: "" },
  )
  const otp = useFormValidation(verifyRecoveryOtpSchema, { email: "", token: "" })

  useEffect(() => {
    if (!resendCoolingDown) return
    const timer = window.setTimeout(() => setResendCoolingDown(false), 60_000)
    return () => window.clearTimeout(timer)
  }, [resendCoolingDown])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !validateForSubmit()) return

    setPending(true)
    const response = await postJson<ForgotPasswordData>(
      "/api/auth/forgot-password",
      { email: values.email },
    )
    setPending(false)

    if (!response.ok) {
      toast.error(response.error.message)
      return
    }

    if (response.message) toast.success(response.message)
    const email = values.email.trim().toLowerCase()
    setRecoveryEmail(email)
    otp.reset({ email, token: "" })
    setResendCoolingDown(true)
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || resendPending || !otp.validateForSubmit()) return

    setPending(true)
    const response = await postJson<AuthRedirectData>("/api/auth/verify-recovery-otp", {
      email: recoveryEmail,
      token: otp.values.token,
    })
    if (!response.ok) {
      setPending(false)
      toast.error(response.error.message)
      return
    }

    if (response.message) toast.success(response.message)
    window.location.replace(response.data.redirectTo)
  }

  async function handleResend() {
    if (!recoveryEmail || pending || resendPending || resendCoolingDown) return
    setResendPending(true)
    const response = await postJson<ForgotPasswordData>("/api/auth/forgot-password", {
      email: recoveryEmail,
    })
    setResendPending(false)
    if (!response.ok) {
      if (response.error.code === "RATE_LIMITED") setResendCoolingDown(true)
      toast.error(response.error.message)
      return
    }
    otp.reset({ email: recoveryEmail, token: "" })
    setResendCoolingDown(true)
    if (response.message) toast.success(response.message)
  }

  if (recoveryEmail) {
    return (
      <form className="space-y-5" noValidate onSubmit={handleVerify}>
        <p aria-live="polite" className="rounded-xl border bg-muted/50 px-4 py-3 text-sm leading-6 text-muted-foreground">
          If an account exists for <strong className="font-medium text-foreground">{recoveryEmail}</strong>,
          you&apos;ll receive a reset code. Enter it below to continue.
        </p>
        <FormField
          {...otp.getFieldProps("token")}
          autoComplete="one-time-code"
          autoFocus
          hint="Enter the 6–8 digit code from your password reset email."
          inputClassName="text-center text-lg font-semibold tracking-[0.35em]"
          inputMode="numeric"
          label="Verification code"
          maxLength={8}
          minLength={6}
          name="token"
          pattern="[0-9]{6,8}"
          placeholder="Enter code"
        />
        <SubmitButton disabled={!otp.isValid || resendPending} pending={pending}>
          Verify code
        </SubmitButton>
        <div className="text-center text-sm text-muted-foreground">
          <p>Didn&apos;t receive the code? Check your spam folder.</p>
          <Button
            disabled={pending || resendPending || resendCoolingDown}
            onClick={handleResend}
            type="button"
            variant="link"
          >
            {resendPending ? "Sending…" : resendCoolingDown ? "Resend available shortly" : "Resend code"}
          </Button>
          <Button
            className="block mx-auto"
            disabled={pending || resendPending}
            onClick={() => setRecoveryEmail(null)}
            type="button"
            variant="link"
          >
            Use a different email address
          </Button>
        </div>
      </form>
    )
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      <FormField
        {...getFieldProps("email")}
        autoComplete="email"
        label="Email address"
        maxLength={254}
        name="email"
        placeholder="you@business.com"
        type="email"
      />
      <SubmitButton disabled={!isValid} pending={pending}>
        Send reset code
      </SubmitButton>
    </form>
  )
}
