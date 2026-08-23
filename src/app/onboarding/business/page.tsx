import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Building2, Store } from "lucide-react"

import {
  BusinessOnboardingForm,
  type BusinessOnboardingInitialValues,
} from "@/features/businesses/onboarding/business-onboarding-form"
import { getBusinessOnboardingDraft } from "@/features/businesses/onboarding/server/get-draft"
import {
  businessCategories,
  countries,
  currencies,
  weekDays,
} from "@/features/businesses/onboarding/options"
import { requireUser } from "@/lib/auth/session"

export const metadata: Metadata = {
  description: "Create your business workspace.",
  title: "Set up your business | Carborony",
}

export default async function BusinessOnboardingPage() {
  const [user, draft] = await Promise.all([requireUser(), getBusinessOnboardingDraft()])
  if (draft?.onboarding_completed_at) redirect("/app/dashboard")

  const metadataBusinessName = user.user_metadata?.business_name
  const openingHours = Array.isArray(draft?.opening_hours)
    ? draft.opening_hours.filter((item): item is BusinessOnboardingInitialValues["openingHours"][number] => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return false
        return weekDays.some(([day]) => day === item.day)
          && typeof item.enabled === "boolean"
          && typeof item.open === "string"
          && typeof item.close === "string"
      })
    : []

  const initialValues: BusinessOnboardingInitialValues = {
    address: draft?.address ?? "",
    categoryCode: businessCategories.find(([value]) => value === draft?.category_code)?.[0] ?? "",
    countryCode: countries.find(([value]) => value === draft?.country_code)?.[0] ?? "NG",
    currencyCode: currencies.find(([value]) => value === draft?.currency_code)?.[0] ?? "NGN",
    description: draft?.description ?? "",
    email: draft?.email ?? user.email ?? "",
    facebookPage: draft?.facebook_page ?? "",
    hasLogo: Boolean(draft?.logo_path),
    instagramAccount: draft?.instagram_account ?? "",
    name: draft?.name ?? (typeof metadataBusinessName === "string" ? metadataBusinessName : ""),
    openingHours,
    phone: draft?.phone ?? "",
    websiteUrl: draft?.website_url ?? "",
    whatsappPhone: draft?.whatsapp_phone ?? "",
  }

  return (
    <main className="min-h-svh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <span className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background"><Store aria-hidden="true" className="size-4" /></span>
          <span className="font-semibold">Carborony</span>
          <span className="ml-auto text-sm text-muted-foreground">Business setup</span>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 max-w-2xl">
          <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 aria-hidden="true" className="size-5" /></span>
          <p className="text-sm font-medium text-primary">One last step</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Create your business</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">Tell us about your business so we can configure your workspace, currency, and reporting correctly.</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
          <BusinessOnboardingForm initialValues={initialValues} />
        </div>
      </div>
    </main>
  )
}
