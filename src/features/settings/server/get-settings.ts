import "server-only"

import { headers } from "next/headers"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { weekDays } from "@/features/businesses/onboarding/options"
import { publicStorageUrl } from "@/features/storefront/server/media-url"
import { requireUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database"
import type {
  DateFormat,
  SettingsOpeningHour,
  SettingsPageData,
  TimeFormat,
} from "../types"

export class SettingsSetupRequiredError extends Error {
  constructor() {
    super("The settings database migration has not been applied.")
    this.name = "SettingsSetupRequiredError"
  }
}

const defaultHours: SettingsOpeningHour[] = weekDays.map(([day], index) => ({
  close: "17:00",
  day,
  enabled: index < 5,
  open: "09:00",
}))

function openingHours(value: Json): SettingsOpeningHour[] {
  if (!Array.isArray(value) || value.length !== 7) return defaultHours
  const mapped = value.flatMap((item) => {
    if (!item || Array.isArray(item) || typeof item !== "object") return []
    const { close, day, enabled, open } = item
    if (
      typeof close !== "string"
      || typeof day !== "string"
      || typeof enabled !== "boolean"
      || typeof open !== "string"
    ) return []
    return [{ close, day, enabled, open }]
  })
  return mapped.length === 7 ? mapped : defaultHours
}

function setupError(code?: string) {
  return ["42P01", "42703", "PGRST202", "PGRST204", "PGRST205"].includes(code ?? "")
}

export async function getSettingsPageData(): Promise<SettingsPageData> {
  const [user, business, requestHeaders] = await Promise.all([
    requireUser(),
    getCurrentBusiness(),
    headers(),
  ])
  const supabase = await createClient()
  const canViewBusiness = business.permissions.includes("settings.view")
  const canManageBusiness = business.permissions.includes("settings.manage")
  const isOwner = business.roleCode === "owner"

  const [profileResult, businessResult, billingResult, invoicesResult] = await Promise.all([
    supabase.from("profiles")
      .select("full_name, phone, avatar_url")
      .eq("id", user.id)
      .single(),
    canViewBusiness
      ? supabase.from("businesses")
          .select("address, category_code, country_code, currency_code, date_format, description, email, facebook_page, instagram_account, locale, logo_path, name, opening_hours, phone, slug, time_format, timezone, website_url, week_starts_on, whatsapp_phone")
          .eq("id", business.id)
          .single()
      : Promise.resolve({ data: null, error: null }),
    isOwner
      ? supabase.from("business_billing_profiles")
          .select("billing_email, billing_interval, cancel_at_period_end, currency_code, current_period_ends_at, payment_method_brand, payment_method_expiry_month, payment_method_expiry_year, payment_method_last_four, plan_amount, plan_code, subscription_status")
          .eq("business_id", business.id)
          .single()
      : Promise.resolve({ data: null, error: null }),
    isOwner
      ? supabase.from("billing_invoices")
          .select("amount_due, amount_paid, currency_code, hosted_invoice_url, id, invoice_number, issued_at, status")
          .eq("business_id", business.id)
          .order("issued_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(25)
      : Promise.resolve({ data: null, error: null }),
  ])

  if (profileResult.error) {
    throw new Error("Unable to load your profile settings.", { cause: profileResult.error })
  }
  if (businessResult.error) {
    if (setupError(businessResult.error.code)) throw new SettingsSetupRequiredError()
    throw new Error("Unable to load business settings.", { cause: businessResult.error })
  }
  if (billingResult.error || invoicesResult.error) {
    const error = billingResult.error ?? invoicesResult.error
    if (setupError(error?.code)) throw new SettingsSetupRequiredError()
    throw new Error("Unable to load billing settings.", { cause: error })
  }

  const profile = profileResult.data
  const savedBusiness = businessResult.data
  const billing = billingResult.data
  const paymentMethod = billing?.payment_method_brand
    && billing.payment_method_last_four
    && billing.payment_method_expiry_month
    && billing.payment_method_expiry_year
    ? {
        brand: billing.payment_method_brand,
        expiryMonth: billing.payment_method_expiry_month,
        expiryYear: billing.payment_method_expiry_year,
        lastFour: billing.payment_method_last_four,
      }
    : null

  return {
    billing: billing ? {
      billingEmail: billing.billing_email ?? user.email ?? "",
      billingInterval: billing.billing_interval as "monthly" | "yearly" | null,
      cancelAtPeriodEnd: billing.cancel_at_period_end,
      currencyCode: billing.currency_code,
      currentPeriodEndsAt: billing.current_period_ends_at,
      invoices: (invoicesResult.data ?? []).map((invoice) => ({
        amountDue: invoice.amount_due,
        amountPaid: invoice.amount_paid,
        currencyCode: invoice.currency_code,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        issuedAt: invoice.issued_at,
        status: invoice.status as "draft" | "open" | "paid" | "void" | "uncollectible",
      })),
      paymentMethod,
      planAmount: billing.plan_amount,
      planCode: billing.plan_code,
      subscriptionStatus: billing.subscription_status as "trialing" | "active" | "past_due" | "cancelled" | "paused",
    } : null,
    business: savedBusiness ? {
      address: savedBusiness.address,
      categoryCode: savedBusiness.category_code ?? "other",
      description: savedBusiness.description,
      email: savedBusiness.email,
      facebookPage: savedBusiness.facebook_page,
      instagramAccount: savedBusiness.instagram_account,
      logoUrl: publicStorageUrl("business-logos", savedBusiness.logo_path),
      name: savedBusiness.name,
      openingHours: openingHours(savedBusiness.opening_hours),
      phone: savedBusiness.phone ?? "",
      slug: savedBusiness.slug,
      websiteUrl: savedBusiness.website_url,
      whatsappPhone: savedBusiness.whatsapp_phone,
    } : null,
    canManageBusiness,
    canViewBusiness,
    isOwner,
    profile: {
      avatarUrl: profile.avatar_url,
      email: user.email ?? "",
      fullName: profile.full_name ?? user.user_metadata?.full_name ?? "",
      phone: profile.phone,
      roleName: business.roleName,
    },
    regional: savedBusiness ? {
      countryCode: savedBusiness.country_code ?? "NG",
      currencyCode: savedBusiness.currency_code,
      dateFormat: savedBusiness.date_format as DateFormat,
      locale: savedBusiness.locale,
      timeFormat: savedBusiness.time_format as TimeFormat,
      timezone: savedBusiness.timezone,
      weekStartsOn: savedBusiness.week_starts_on,
    } : null,
    session: {
      lastSignedInAt: user.last_sign_in_at ?? null,
      userAgent: requestHeaders.get("user-agent") ?? "Current browser",
    },
  }
}
