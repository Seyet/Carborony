import type { Metadata } from "next"
import { UserRoundCog } from "lucide-react"

import { FeaturePlaceholder } from "@/components/layout/feature-placeholder"

export const metadata: Metadata = { title: "Staff" }

export default function StaffPage() {
  return (
    <FeaturePlaceholder
      title="Staff"
      description="The reserved workspace for future team and staff administration."
      route="/app/staff"
      icon={UserRoundCog}
    />
  )
}
