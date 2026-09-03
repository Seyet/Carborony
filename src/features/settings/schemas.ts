import { z } from "zod"

import { businessCategories, weekDays } from "@/features/businesses/onboarding/options"
import {
  countryValues,
  currencyValues,
  dateFormats,
  localeValues,
  timeFormats,
} from "./options"

const normalizedPhone = z.preprocess(
  (value) => value ?? "",
  z.string().trim().max(32).transform((value) =>
    value ? value.replace(/[\s().-]/g, "") : null,
  ).pipe(z.string().regex(
    /^(?:\+[1-9]\d{7,14}|0\d{7,14})$/,
    "Enter a valid phone number.",
  ).nullable()),
)

const optionalText = (maximum: number) => z.preprocess(
  (value) => value ?? "",
  z.string().trim().max(maximum).transform((value) => value || null),
)

const optionalUrl = z.preprocess(
  (value) => value ?? "",
  z.string().trim().max(2048).refine(
    (value) => !value || URL.canParse(value),
    "Enter a complete URL, including https://.",
  ).transform((value) => value || null),
)

const imageChange = z.discriminatedUnion("action", [
  z.object({ action: z.literal("keep") }),
  z.object({ action: z.literal("remove") }),
  z.object({
    action: z.literal("replace"),
    dataUrl: z.string().max(1_500_000),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  }),
])

const openingHour = z.object({
  close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  day: z.enum(weekDays.map(([value]) => value)),
  enabled: z.boolean(),
  open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
}).refine((value) => !value.enabled || value.open < value.close, {
  message: "Closing time must be later than opening time.",
  path: ["close"],
})

export const profileSettingsSchema = z.object({
  avatar: imageChange,
  fullName: z.string().trim().min(2, "Name must be at least 2 characters.")
    .max(100, "Name must be 100 characters or fewer.")
    .regex(/\p{L}/u, "Enter your full name."),
  phone: normalizedPhone,
})

export const businessProfileSettingsSchema = z.object({
  address: optionalText(500),
  categoryCode: z.enum(businessCategories.map(([value]) => value), {
    message: "Select a business category.",
  }),
  description: optionalText(1000),
  email: z.preprocess(
    (value) => value ?? "",
    z.string().trim().max(254).refine(
      (value) => !value || z.email().safeParse(value).success,
      "Enter a valid business email.",
    ).transform((value) => value ? value.toLowerCase() : null),
  ),
  facebookPage: optionalText(255),
  instagramAccount: optionalText(255),
  logo: imageChange,
  name: z.string().trim().min(2, "Business name must be at least 2 characters.")
    .max(120, "Business name must be 120 characters or fewer."),
  openingHours: z.array(openingHour).length(7).superRefine((hours, context) => {
    if (new Set(hours.map((hoursForDay) => hoursForDay.day)).size !== 7) {
      context.addIssue({ code: "custom", message: "Configure every day exactly once." })
    }
  }),
  phone: z.string().trim().min(8, "Enter a valid phone number.").max(24)
    .transform((value) => value.replace(/[\s().-]/g, ""))
    .pipe(z.string().regex(/^(?:\+[1-9]\d{7,14}|0\d{7,14})$/, "Enter a valid phone number.")),
  websiteUrl: optionalUrl,
  whatsappPhone: normalizedPhone,
})

function validTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

export const regionalSettingsSchema = z.object({
  countryCode: z.enum(countryValues, { message: "Select a country." }),
  currencyCode: z.enum(currencyValues, { message: "Select a currency." }),
  dateFormat: z.enum(dateFormats.map(([value]) => value)),
  locale: z.enum(localeValues, { message: "Select a display language and locale." }),
  timeFormat: z.enum(timeFormats.map(([value]) => value)),
  timezone: z.string().trim().min(1, "Select a timezone.").max(64)
    .refine(validTimeZone, "Select a valid timezone."),
  weekStartsOn: z.number().int().min(0).max(6),
})

export const billingContactSettingsSchema = z.object({
  billingEmail: z.string().trim().email("Enter a valid billing email address.")
    .max(254, "Billing email must be 254 characters or fewer.").toLowerCase(),
})

const password = z.string().min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.")
  .regex(/[a-z]/, "Include at least one lowercase letter.")
  .regex(/[A-Z]/, "Include at least one uppercase letter.")
  .regex(/[0-9]/, "Include at least one number.")

export const securitySettingsSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("change_password"),
    confirmPassword: z.string(),
    currentPassword: z.string().min(1, "Enter your current password.").max(72),
    password,
  }).superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        message: "Passwords do not match.",
        path: ["confirmPassword"],
      })
    }
    if (value.password === value.currentPassword) {
      context.addIssue({
        code: "custom",
        message: "Choose a password different from your current password.",
        path: ["password"],
      })
    }
  }),
  z.object({ action: z.literal("sign_out_others") }),
])

export type BusinessProfileSettingsInput = z.output<typeof businessProfileSettingsSchema>
export type BillingContactSettingsInput = z.output<typeof billingContactSettingsSchema>
export type ProfileSettingsInput = z.output<typeof profileSettingsSchema>
export type RegionalSettingsInput = z.output<typeof regionalSettingsSchema>
export type SecuritySettingsInput = z.output<typeof securitySettingsSchema>
