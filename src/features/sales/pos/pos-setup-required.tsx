import { DatabaseZap } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function PosSetupRequired() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center">
      <Card className="w-full">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <DatabaseZap aria-hidden="true" className="size-5" />
          </div>
          <CardTitle>Sales database setup required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>The POS tables and invoice fields have not been applied to this Supabase project yet.</p>
          <p>Run <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">supabase db push</code>, then refresh this page. The POS and external-item migrations must run in order.</p>
        </CardContent>
      </Card>
    </div>
  )
}
