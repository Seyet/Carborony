import type { Metadata } from "next"
import { Sparkles } from "lucide-react"

import { FeaturePlaceholder } from "@/components/layout/feature-placeholder"

export const metadata: Metadata = { title: "AI Content" }

export default function AiContentPage() {
  return (
    <FeaturePlaceholder
      title="AI Content"
      description="The reserved workspace for future assisted content tools. No AI service is connected yet."
      route="/app/marketing/ai-content"
      icon={Sparkles}
    />
  )
}
