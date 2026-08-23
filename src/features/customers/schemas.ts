import { z } from "zod"

import { customerSegments } from "./types"

const optionalEmail = z.string().trim().max(254, "Email must be 254 characters or fewer.")
  .refine((value) => !value || z.email().safeParse(value).success, "Enter a valid email address.")
  .transform((value) => value || null)

const optionalPhone = z.string().trim().max(32, "Phone number must be 32 characters or fewer.")
  .refine((value) => !value || (
    value.length >= 7 && /^[0-9+(). -]+$/.test(value)
  ), "Enter a valid phone number.")
  .transform((value) => value || null)

const optionalText = (maximum: number, message: string) => z.string().trim()
  .max(maximum, message).transform((value) => value || null)

export const saveCustomerSchema = z.object({
  address: optionalText(500, "Address must be 500 characters or fewer.")
    .refine((value) => value === null || value.length >= 5, "Address must be at least 5 characters."),
  birthday: z.string().trim().refine((value) => {
    if (!value) return true
    const birthday = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(birthday.getTime())
      && value >= "1900-01-01"
      && birthday <= new Date()
  }, "Enter a valid birthday.").transform((value) => value || null),
  email: optionalEmail,
  fullName: z.string().trim().min(2, "Name must be at least 2 characters.")
    .max(120, "Name must be 120 characters or fewer."),
  notes: optionalText(2_000, "Notes must be 2,000 characters or fewer."),
  phone: optionalPhone,
  segment: z.enum(customerSegments),
  tags: z.array(z.string().trim().min(1).max(40)).max(20, "Use no more than 20 tags."),
}).refine((value) => Boolean(value.phone || value.email), {
  message: "Enter a phone number or email address.",
  path: ["phone"],
})

export type SaveCustomerInput = z.output<typeof saveCustomerSchema>
