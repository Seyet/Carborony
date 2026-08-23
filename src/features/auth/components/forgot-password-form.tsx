"use client"

import { type FormEvent, useState } from "react"
import { toast } from "sonner"

import type { ForgotPasswordData } from "@/features/auth/api-types"
import { FormField } from "@/features/auth/components/form-field"
import { SubmitButton } from "@/features/auth/components/submit-button"
import { forgotPasswordSchema } from "@/features/auth/schemas"
import { useFormValidation } from "@/features/auth/use-form-validation"
import { postJson } from "@/lib/api/client"

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false)
  const {
    getFieldProps,
    isValid,
    reset,
    validateForSubmit,
    values,
  } = useFormValidation(
    forgotPasswordSchema,
    { email: "" },
  )

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
    reset()
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
        Send reset instructions
      </SubmitButton>
    </form>
  )
}
