"use client"

import Link from "next/link"
import {
  type FormEvent,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react"
import { LoaderCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  AuthRedirectData,
  ResendSignupOtpData,
} from "@/features/auth/api-types"
import { FormField } from "@/features/auth/components/form-field"
import { SubmitButton } from "@/features/auth/components/submit-button"
import {
  clearPendingSignupEmail,
  getPendingSignupEmail,
  getPendingSignupResendAvailableAt,
  savePendingSignupEmail,
  signupOtpResendCooldownMs,
} from "@/features/auth/pending-signup"
import {
  resendSignupOtpSchema,
  verifySignupOtpSchema,
} from "@/features/auth/schemas"
import { useFormValidation } from "@/features/auth/use-form-validation"
import { postJson } from "@/lib/api/client"

function subscribeToPendingSignupEmail() {
  return () => undefined
}

function getServerPendingSignupEmail() {
  return undefined
}

function OtpForm({ initialEmail }: { initialEmail: string | null }) {
  const [pending, setPending] = useState(false)
  const [resendPending, setResendPending] = useState(false)
  const [resendAvailableAt, setResendAvailableAt] = useState(
    getPendingSignupResendAvailableAt,
  )
  const [resendCoolingDown, setResendCoolingDown] = useState(
    resendAvailableAt > 0,
  )
  const {
    getFieldProps,
    isValid,
    reset,
    touchField,
    validateForSubmit,
    values,
  } = useFormValidation(
    verifySignupOtpSchema,
    { email: initialEmail ?? "", token: "" },
  )

  useEffect(() => {
    if (!resendAvailableAt) return

    const timeout = window.setTimeout(
      () => setResendCoolingDown(false),
      Math.max(1, resendAvailableAt - Date.now()),
    )

    return () => window.clearTimeout(timeout)
  }, [resendAvailableAt])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || resendPending || !validateForSubmit()) return

    setPending(true)
    const response = await postJson<AuthRedirectData>("/api/auth/verify-otp", {
      email: values.email,
      token: values.token,
    })

    if (!response.ok) {
      setPending(false)
      toast.error(response.error.message)
      return
    }

    clearPendingSignupEmail()
    if (response.message) toast.success(response.message)
    window.location.replace(response.data.redirectTo)
  }

  async function handleResend() {
    if (pending || resendPending || resendCoolingDown) return

    const emailValidation = resendSignupOtpSchema.safeParse({
      email: values.email,
    })

    if (!emailValidation.success) {
      touchField("email")
      return
    }

    setResendPending(true)
    const response = await postJson<ResendSignupOtpData>(
      "/api/auth/resend-otp",
      { email: emailValidation.data.email },
    )
    setResendPending(false)

    if (!response.ok) {
      if (response.error.code === "RATE_LIMITED") {
        const nextResendAt = Date.now() + signupOtpResendCooldownMs
        savePendingSignupEmail(emailValidation.data.email, nextResendAt)
        setResendAvailableAt(nextResendAt)
        setResendCoolingDown(true)
      }

      toast.error(response.error.message)
      return
    }

    const nextResendAt = Date.now() + signupOtpResendCooldownMs
    savePendingSignupEmail(emailValidation.data.email, nextResendAt)
    reset({ email: emailValidation.data.email, token: "" })
    setResendAvailableAt(nextResendAt)
    setResendCoolingDown(true)
    if (response.message) toast.success(response.message)
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      {initialEmail ? (
        <p className="rounded-xl border bg-muted/50 px-4 py-3 text-sm leading-6 text-muted-foreground">
          Code sent to{" "}
          <strong className="font-medium text-foreground">
            {initialEmail}
          </strong>
        </p>
      ) : (
        <FormField
          {...getFieldProps("email")}
          autoComplete="email"
          label="Registration email"
          maxLength={254}
          name="email"
          placeholder="you@business.com"
          type="email"
        />
      )}
      <FormField
        {...getFieldProps("token")}
        autoCapitalize="none"
        autoComplete="one-time-code"
        autoFocus
        hint="Enter the 6-digit code from your email."
        inputClassName="text-center text-lg font-semibold tracking-[0.35em]"
        inputMode="numeric"
        label="Verification code"
        maxLength={6}
        minLength={6}
        name="token"
        pattern="[0-9]{6}"
        placeholder="000000"
      />
      <SubmitButton disabled={!isValid || resendPending} pending={pending}>
        Verify email
      </SubmitButton>
      <div className="flex flex-wrap items-center justify-center gap-x-1 text-sm text-muted-foreground">
        <span>Didn&apos;t receive the code?</span>
        <Button
          className="h-auto px-1 py-0"
          disabled={pending || resendPending || resendCoolingDown}
          onClick={handleResend}
          type="button"
          variant="link"
        >
          {resendPending ? (
            <>
              <LoaderCircle aria-hidden="true" className="animate-spin" />
              Sending
            </>
          ) : resendCoolingDown ? (
            "Resend available shortly"
          ) : (
            "Resend code"
          )}
        </Button>
      </div>
      <div className="text-center">
        <Link
          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          href="/register"
          onClick={clearPendingSignupEmail}
        >
          Use a different email address
        </Link>
      </div>
    </form>
  )
}

export function OtpVerificationForm() {
  const email = useSyncExternalStore(
    subscribeToPendingSignupEmail,
    getPendingSignupEmail,
    getServerPendingSignupEmail,
  )

  if (email === undefined) {
    return (
      <div aria-label="Loading verification form" className="space-y-5">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    )
  }

  return <OtpForm initialEmail={email} />
}
