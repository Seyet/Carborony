"use client"

import { type FormEvent, useState } from "react"
import { toast } from "sonner"

import type { AuthRedirectData } from "@/features/auth/api-types"
import { FormField } from "@/features/auth/components/form-field"
import { SubmitButton } from "@/features/auth/components/submit-button"
import { resetPasswordSchema } from "@/features/auth/schemas"
import { useFormValidation } from "@/features/auth/use-form-validation"
import { postJson } from "@/lib/api/client"

export function ResetPasswordForm() {
  const [pending, setPending] = useState(false)
  const { getFieldProps, isValid, validateForSubmit, values } =
    useFormValidation(
      resetPasswordSchema,
      { confirmPassword: "", password: "" },
    )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !validateForSubmit()) return

    setPending(true)
    const response = await postJson<AuthRedirectData>(
      "/api/auth/reset-password",
      {
        confirmPassword: values.confirmPassword,
        password: values.password,
      },
    )

    if (!response.ok) {
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
        {...getFieldProps("password")}
        autoComplete="new-password"
        hint="Use 8–72 characters with uppercase, lowercase, and a number."
        label="New password"
        maxLength={72}
        minLength={8}
        name="password"
        placeholder="Create a strong password"
        type="password"
      />
      <FormField
        {...getFieldProps("confirmPassword")}
        autoComplete="new-password"
        label="Confirm new password"
        maxLength={72}
        name="confirmPassword"
        placeholder="Enter your password again"
        type="password"
      />
      <SubmitButton disabled={!isValid} pending={pending}>
        Update password
      </SubmitButton>
    </form>
  )
}
