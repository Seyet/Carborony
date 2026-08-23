"use client"

import Link from "next/link"
import { type FormEvent, useEffect, useState } from "react"
import { toast } from "sonner"

import type { AuthRedirectData } from "@/features/auth/api-types"
import { FormField } from "@/features/auth/components/form-field"
import { SubmitButton } from "@/features/auth/components/submit-button"
import { savePendingSignupEmail } from "@/features/auth/pending-signup"
import { loginSchema } from "@/features/auth/schemas"
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !validateForSubmit()) return

    setPending(true)
    const response = await postJson<AuthRedirectData>("/api/auth/login", {
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
      toast.error(response.error.message)
      return
    }

    if (response.message) toast.success(response.message)
    window.location.assign(response.data.redirectTo)
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
