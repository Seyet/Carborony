"use client"

import { type FormEvent, useState } from "react"
import { toast } from "sonner"

import type { RegistrationData } from "@/features/auth/api-types"
import { FormField } from "@/features/auth/components/form-field"
import { SubmitButton } from "@/features/auth/components/submit-button"
import {
  savePendingSignupEmail,
} from "@/features/auth/pending-signup"
import { registrationSchema } from "@/features/auth/schemas"
import { useFormValidation } from "@/features/auth/use-form-validation"
import { postJson } from "@/lib/api/client"

export function RegisterForm() {
  const [pending, setPending] = useState(false)
  const {
    getFieldProps,
    isValid,
    validateForSubmit,
    values,
  } = useFormValidation(
    registrationSchema,
    {
      email: "",
      fullName: "",
      password: "",
    },
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !validateForSubmit()) return

    setPending(true)
    const response = await postJson<RegistrationData>("/api/auth/register", {
      email: values.email,
      fullName: values.fullName,
      password: values.password,
    })
    setPending(false)

    if (!response.ok) {
      toast.error(response.error.message)
      return
    }

    savePendingSignupEmail(response.data.email)

    if (response.message) toast.success(response.message)
    window.location.replace(response.data.redirectTo)
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      <FormField
        {...getFieldProps("fullName")}
        autoComplete="name"
        label="Full name"
        maxLength={100}
        minLength={2}
        name="fullName"
        placeholder="Ada Okafor"
      />
      <FormField
        {...getFieldProps("email")}
        autoComplete="email"
        label="Work email"
        maxLength={254}
        name="email"
        placeholder="you@business.com"
        type="email"
      />
      <FormField
        {...getFieldProps("password")}
        autoComplete="new-password"
        hint="Use 8–72 characters with uppercase, lowercase, and a number."
        label="Password"
        maxLength={72}
        minLength={8}
        name="password"
        placeholder="Create a strong password"
        type="password"
      />
      <SubmitButton disabled={!isValid} pending={pending}>
        Create account
      </SubmitButton>
      <p className="text-center text-xs leading-5 text-muted-foreground">
        By creating an account, you agree to keep your business information
        accurate and secure.
      </p>
    </form>
  )
}
