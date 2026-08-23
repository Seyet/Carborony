import type { Metadata } from "next"
import { Megaphone } from "lucide-react"

import { FeaturePlaceholder } from "@/components/layout/feature-placeholder"

export const metadata: Metadata = { title: "Campaigns" }

export default function CampaignsPage() {
  return (
    <FeaturePlaceholder
      title="Campaigns"
      description="The reserved workspace for future marketing campaign workflows."
      route="/app/marketing/campaigns"
      icon={Megaphone}
    />
  )
}
