import { z } from "zod"

import { businessCategories, countries, currencies, weekDays } from "./options"

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).transform((value) => value || null)

const optionalUrl = z.string().trim().max(2048).refine(
  (value) => !value || URL.canParse(value),
  "Enter a complete URL, including https://.",
).transform((value) => value || null)

const phone = z.string().trim().min(8, "Enter a valid phone number.")
  .max(24, "Phone number is too long.")
  .transform((value) => value.replace(/[\s().-]/g, ""))
  .pipe(z.string().regex(/^(?:\+[1-9]\d{7,14}|0\d{7,14})$/, "Enter a valid phone number."))

const optionalPhone = z.string().trim().max(24).transform((value) =>
  value ? value.replace(/[\s().-]/g, "") : null,
).pipe(z.string().regex(
  /^(?:\+[1-9]\d{7,14}|0\d{7,14})$/,
  "Enter a valid WhatsApp number.",
).nullable())

const openingHour = z.object({
  close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  day: z.enum(weekDays.map(([value]) => value)),
  enabled: z.boolean(),
  open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
}).refine((value) => !value.enabled || value.open < value.close, {
  message: "Closing time must be later than opening time.",
  path: ["close"],
})

export const businessOnboardingSchema = z.object({
  address: optionalText(500),
  categoryCode: z.enum(businessCategories.map(([value]) => value), {
    message: "Select a business category.",
  }),
  countryCode: z.enum(countries.map(([value]) => value), {
    message: "Select a country.",
  }),
  currencyCode: z.enum(currencies.map(([value]) => value), {
    message: "Select a currency.",
  }),
  description: optionalText(1000),
  email: z.string().trim().max(254).refine(
    (value) => !value || z.email().safeParse(value).success,
    "Enter a valid business email.",
  ).transform((value) => value ? value.toLowerCase() : null),
  facebookPage: optionalText(255),
  instagramAccount: optionalText(255),
  logo: z.object({
    dataUrl: z.string().max(1_500_000),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  }).nullable(),
  name: z.string().trim().min(2, "Business name must be at least 2 characters.")
    .max(120, "Business name must be 120 characters or fewer."),
  openingHours: z.array(openingHour).length(7),
  phone,
  websiteUrl: optionalUrl,
  whatsappPhone: optionalPhone,
})

export type BusinessOnboardingInput = z.output<typeof businessOnboardingSchema>
export type BusinessOnboardingRequest = z.input<typeof businessOnboardingSchema>
