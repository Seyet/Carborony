"use client"

import { type ChangeEvent, useMemo, useState } from "react"
import type { ZodType } from "zod"

type FormValues = Record<string, string>

export function useFormValidation(
  schema: ZodType,
  initialValues: FormValues,
) {
  const [values, setValues] = useState<FormValues>(initialValues)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const validation = useMemo(() => schema.safeParse(values), [schema, values])

  function getFieldMessage(name: string) {
    if (validation.success) return undefined

    return validation.error.issues.find((issue) => issue.path[0] === name)
      ?.message
  }

  function getFieldProps(name: string) {
    const message = getFieldMessage(name)
    const errorMessage = touched[name] ? message : undefined

    return {
      errorMessage,
      invalid: Boolean(errorMessage),
      onBlur: () => {
        setTouched((current) => ({ ...current, [name]: true }))
      },
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        const value = event.currentTarget.value
        setTouched((current) =>
          current[name] ? current : { ...current, [name]: true },
        )
        setValues((current) => ({ ...current, [name]: value }))
      },
      value: values[name] ?? "",
    }
  }

  function validateForSubmit() {
    if (validation.success) return true

    const invalidFields = validation.error.issues.reduce<Record<string, boolean>>(
      (fields, issue) => {
        const field = issue.path[0]

        if (typeof field === "string") fields[field] = true
        return fields
      },
      {},
    )

    setTouched((current) => ({ ...current, ...invalidFields }))

    return false
  }

  function touchField(name: string) {
    setTouched((current) => ({ ...current, [name]: true }))
  }

  function reset(nextValues: FormValues = initialValues) {
    setTouched({})
    setValues({ ...nextValues })
  }

  return {
    getFieldProps,
    isValid: validation.success,
    reset,
    touchField,
    validateForSubmit,
    values,
  }
}
