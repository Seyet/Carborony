import type { Metadata } from "next"
import { ReceiptText } from "lucide-react"

import { FeaturePlaceholder } from "@/components/layout/feature-placeholder"

export const metadata: Metadata = { title: "Expenses" }

export default function ExpensesPage() {
  return (
    <FeaturePlaceholder
      title="Expenses"
      description="The reserved workspace for future business expense capture and review."
      route="/app/expenses"
      icon={ReceiptText}
    />
  )
}
