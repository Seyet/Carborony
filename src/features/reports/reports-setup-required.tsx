import { BarChart3 } from "lucide-react"

import { EmptyState } from "@/components/common"

export function ReportsSetupRequired() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs text-muted-foreground">Analytics / Reports</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Reports
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review sales, inventory, expenses, and profitability in one place.
        </p>
      </header>
      <EmptyState
        description="Apply the reports database migration, then reload this page to view and export business reports."
        icon={BarChart3}
        title="Reports need database setup"
      />
    </div>
  )
}
