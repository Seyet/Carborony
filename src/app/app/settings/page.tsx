import type { Metadata } from "next"

import { getSettingsPageData, SettingsSetupRequiredError } from "@/features/settings/server/get-settings"
import { SettingsSetupRequired } from "@/features/settings/settings-setup-required"
import { SettingsWorkspace } from "@/features/settings/settings-workspace"

export const metadata: Metadata = { title: "Settings" }

type SettingsSection = "billing" | "business" | "integrations" | "profile" | "regional"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    instagram?: string | string[]
    section?: string | string[]
  }>
}) {
  const params = await searchParams
  const requested = Array.isArray(params.section) ? params.section[0] : params.section
  const instagramResult = Array.isArray(params.instagram)
    ? params.instagram[0]
    : params.instagram
  const initialSection: SettingsSection = requested === "profile" || requested === "regional" || requested === "billing" || requested === "integrations"
    ? requested
    : "business"

  let data: Awaited<ReturnType<typeof getSettingsPageData>>
  try {
    data = await getSettingsPageData()
  } catch (error) {
    if (error instanceof SettingsSetupRequiredError) return <SettingsSetupRequired />
    throw error
  }

  return (
    <SettingsWorkspace
      data={data}
      initialSection={initialSection}
      instagramResult={instagramResult}
    />
  )
}
