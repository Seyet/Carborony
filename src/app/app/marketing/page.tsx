import type { Metadata } from "next"
import { Megaphone } from "lucide-react"

import { FeaturePlaceholder } from "@/components/layout/feature-placeholder"

export const metadata: Metadata = { title: "Marketing" }

export default function MarketingPage() {
  return (
    <FeaturePlaceholder
      title="Marketing"
      description="The reserved home for future social commerce and marketing workspaces."
      route="/app/marketing"
      icon={Megaphone}
    />
  )
}
