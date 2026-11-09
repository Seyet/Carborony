"use client"

import Link from "next/link"
import { type FormEvent, useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import type { AuthRedirectData, ForgotPasswordData } from "@/features/auth/api-types"
import { FormField } from "@/features/auth/components/form-field"
import { SubmitButton } from "@/features/auth/components/submit-button"
import { savePendingSignupEmail } from "@/features/auth/pending-signup"
import { loginSchema, verifyLoginOtpSchema } from "@/features/auth/schemas"
import { useFormValidation } from "@/features/auth/use-form-validation"
import { postJson } from "@/lib/api/client"

type LoginFormProps = {
  hasLinkError?: boolean
  nextPath?: string
  passwordReset?: boolean
}

export function LoginForm({
  hasLinkError = false,
  nextPath,
  passwordReset = false,
}: LoginFormProps) {
  const [pending, setPending] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [coolingDown, setCoolingDown] = useState(false)
  const otp = useFormValidation(verifyLoginOtpSchema.pick({ token: true }), { token: "" })

  useEffect(() => {
    if (!coolingDown) return
    const timer = window.setTimeout(() => setCoolingDown(false), 60_000)
    return () => window.clearTimeout(timer)
  }, [coolingDown])
  const { getFieldProps, isValid, validateForSubmit, values } =
    useFormValidation(
      loginSchema,
      { email: "", password: "" },
    )

  useEffect(() => {
    if (hasLinkError) {
      toast.error(
        "That sign-in link is invalid or has expired. Request a new link and try again.",
        { id: "login-link-error" },
      )
      return
    }

    if (passwordReset) {
      toast.success("Your password has been updated. Sign in to continue.", {
        id: "password-reset-success",
      })
    }
  }, [hasLinkError, passwordReset])

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    if (pending || !validateForSubmit()) return

    setPending(true)
    const response = await postJson<ForgotPasswordData>("/api/auth/login", {
      email: values.email,
      next: nextPath,
      password: values.password,
    })

    if (!response.ok) {
      if (response.error.code === "EMAIL_NOT_CONFIRMED") {
        savePendingSignupEmail(values.email.trim().toLowerCase(), 0)
        window.location.replace("/verify-otp")
        return
      }

      setPending(false)
      if (response.error.code === "RATE_LIMITED") setCoolingDown(true)
      toast.error(response.error.message)
      return
    }

    if (response.message) toast.success(response.message)
    setPending(false)
    setCodeSent(true)
    setCoolingDown(true)
    otp.reset({ token: "" })
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !otp.validateForSubmit()) return
    setPending(true)
    const response = await postJson<AuthRedirectData>("/api/auth/verify-login-otp", {
      email: values.email, password: values.password, next: nextPath, token: otp.values.token,
    })
    if (!response.ok) {
      setPending(false)
      toast.error(response.error.message)
      return
    }
    window.location.replace(response.data.redirectTo)
  }

  if (codeSent) {
    return (
      <form className="space-y-5" noValidate onSubmit={handleVerify}>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          Enter the sign-in code sent to {values.email.trim().toLowerCase()}.
        </p>
        <FormField {...otp.getFieldProps("token")} autoComplete="one-time-code" autoFocus
          inputMode="numeric" label="Verification code" name="token"
          minLength={6} maxLength={8} pattern="[0-9]{6,8}"
          hint="Enter the 6–8 digit code from your email." />
        <SubmitButton disabled={!otp.isValid} pending={pending}>Verify and sign in</SubmitButton>
        <Button disabled={pending || coolingDown} type="button" variant="link"
          onClick={() => void handleSubmit()}>
          {coolingDown ? "Resend available shortly" : "Resend code"}
        </Button>
        <Button disabled={pending} type="button" variant="link" onClick={() => {
          setCodeSent(false)
          otp.reset({ token: "" })
        }}>Back to sign in</Button>
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
      <FormField
        {...getFieldProps("password")}
        autoComplete="current-password"
        label="Password"
        labelAccessory={
          <Link
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            href="/forgot-password"
          >
            Forgot password?
          </Link>
        }
        name="password"
        placeholder="Enter your password"
        type="password"
      />
      <SubmitButton disabled={!isValid} pending={pending}>
        Sign in
      </SubmitButton>
    </form>
  )
}
