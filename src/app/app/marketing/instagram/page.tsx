import type { Metadata } from "next"
import { Camera } from "lucide-react"

import { FeaturePlaceholder } from "@/components/layout/feature-placeholder"

export const metadata: Metadata = { title: "Instagram" }

export default function InstagramPage() {
  return (
    <FeaturePlaceholder
      title="Instagram"
      description="The reserved workspace for a future Instagram integration. No external API is connected yet."
      route="/app/marketing/instagram"
      icon={Camera}
    />
  )
}
