"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, CreditCard, Globe2, Settings, UserRound } from "lucide-react"

import { cn } from "@/lib/utils"
import { BillingSettings } from "./billing-settings"
import { BusinessProfileSettings } from "./business-profile-settings"
import { ProfileSettings } from "./profile-settings"
import { RegionalSettings } from "./regional-settings"
import type { SettingsPageData } from "./types"

type SettingsSection = "billing" | "business" | "profile" | "regional"

const sectionDetails = {
  billing: { description: "Plan, payment method, and invoices", icon: CreditCard, label: "Billing" },
  business: { description: "Identity, contact details, and opening hours", icon: Building2, label: "Business profile" },
  profile: { description: "Personal details and account security", icon: UserRound, label: "My profile" },
  regional: { description: "Country, currency, timezone, and formats", icon: Globe2, label: "Regional settings" },
} as const

export function SettingsWorkspace({
  data,
  initialSection,
}: {
  data: SettingsPageData
  initialSection: SettingsSection
}) {
  const router = useRouter()
  const availableSections: SettingsSection[] = data.canViewBusiness
    ? ["profile", "business", "regional", ...(data.billing ? ["billing" as const] : [])]
    : ["profile"]
  const [section, setSection] = useState<SettingsSection>(
    availableSections.includes(initialSection) ? initialSection : availableSections[0],
  )

  function selectSection(nextSection: SettingsSection) {
    setSection(nextSection)
    router.replace(`/app/settings?section=${nextSection}`, { scroll: false })
  }

  const current = sectionDetails[section]

  return (
    <div className="space-y-6">
      <header>
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"><Settings aria-hidden="true" className="size-3.5" />Workspace settings</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Manage your profile, business identity, regional defaults, and subscription details.</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="grid gap-1 rounded-xl border bg-card p-2 lg:sticky lg:top-24">
          {availableSections.map((item) => {
            const details = sectionDetails[item]
            const Icon = details.icon
            return (
              <button
                aria-current={section === item ? "page" : undefined}
                className={cn(
                  "flex items-start gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-muted",
                  section === item && "bg-primary/8 text-primary",
                )}
                key={item}
                onClick={() => selectSection(item)}
                type="button"
              >
                <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span><strong className="block text-sm font-medium">{details.label}</strong><span className={cn("mt-0.5 block text-xs leading-4 text-muted-foreground", section === item && "text-primary/75")}>{details.description}</span></span>
              </button>
            )
          })}
        </nav>

        <main className="min-w-0">
          <div className="mb-4"><h2 className="text-xl font-semibold">{current.label}</h2><p className="mt-1 text-sm text-muted-foreground">{current.description}</p></div>
          {section === "profile" ? <ProfileSettings data={data} /> : null}
          {section === "business" && data.business ? <BusinessProfileSettings business={data.business} canManage={data.canManageBusiness} /> : null}
          {section === "regional" && data.regional ? <RegionalSettings canManage={data.canManageBusiness} isOwner={data.isOwner} regional={data.regional} /> : null}
          {section === "billing" && data.billing ? <BillingSettings billing={data.billing} data={data} /> : null}
        </main>
      </div>
    </div>
  )
}
