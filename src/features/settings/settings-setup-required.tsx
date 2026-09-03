import { DatabaseZap } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function SettingsSetupRequired() {
  return (
    <Card className="mx-auto mt-16 max-w-xl">
      <CardHeader><CardTitle as="h1" className="flex items-center gap-2"><DatabaseZap aria-hidden="true" className="size-5" />Settings setup required</CardTitle></CardHeader>
      <CardContent className="text-sm leading-6 text-muted-foreground">Apply the latest Supabase settings migrations to enable business profile, regional configuration, and billing.</CardContent>
    </Card>
  )
}
