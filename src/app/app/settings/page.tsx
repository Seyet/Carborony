import type { Metadata } from "next"
import { Settings } from "lucide-react"

import { FeaturePlaceholder } from "@/components/layout/feature-placeholder"

export const metadata: Metadata = { title: "Settings" }

export default function SettingsPage() {
  return (
    <FeaturePlaceholder
      title="Settings"
      description="The reserved workspace for future business and account configuration."
      route="/app/settings"
      icon={Settings}
    />
  )
}
