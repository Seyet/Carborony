import type { Metadata } from "next"
import { BarChart3 } from "lucide-react"

import { FeaturePlaceholder } from "@/components/layout/feature-placeholder"

export const metadata: Metadata = { title: "Reports" }

export default function ReportsPage() {
  return (
    <FeaturePlaceholder
      title="Reports"
      description="The reserved workspace for future business reporting and performance insights."
      route="/app/reports"
      icon={BarChart3}
    />
  )
}
