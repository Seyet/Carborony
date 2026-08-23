import type { Metadata } from "next"
import { Radio } from "lucide-react"

import { FeaturePlaceholder } from "@/components/layout/feature-placeholder"

export const metadata: Metadata = { title: "Social Posts" }

export default function SocialPostsPage() {
  return (
    <FeaturePlaceholder
      title="Social Posts"
      description="The reserved workspace for future social post planning and publishing tools."
      route="/app/marketing/social-posts"
      icon={Radio}
    />
  )
}
