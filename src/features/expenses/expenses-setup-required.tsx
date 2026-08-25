import { Database, ReceiptText } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function ExpensesSetupRequired() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <Card>
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <Database aria-hidden="true" className="size-5" />
          </div>
          <CardTitle as="h1" className="text-xl">
            Expense management setup required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Apply the latest Supabase migration before recording and reviewing expenses.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs text-foreground">
            <code>npx supabase db push</code>
          </pre>
          <p className="flex items-center gap-2">
            <ReceiptText aria-hidden="true" className="size-4" />
            Refresh this page after the migration finishes.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
