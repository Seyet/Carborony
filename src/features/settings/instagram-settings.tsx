import { AlertTriangle, ArrowUpRight, CheckCircle2, DatabaseZap, KeyRound } from "lucide-react"

import { ButtonLink } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InstagramConnectionCard } from "@/features/instagram/instagram-connection-card"
import type { InstagramSettingsData } from "@/features/instagram/types"

export function InstagramSettings({
  canManage,
  data,
  result,
}: {
  canManage: boolean
  data: InstagramSettingsData
  result?: string
}) {
  const ready = data.setupReady && data.configurationReady
  const connectionNotice = result === "connected"
    ? { message: "Instagram connected successfully. Sync now to import recent posts.", success: true }
    : result === "cancelled"
      ? { message: "Instagram connection was cancelled. No account changes were made.", success: false }
      : result
        ? { message: "Instagram could not be connected. Check the Meta app configuration and try again.", success: false }
        : null

  return (
    <div className="space-y-4">
      {connectionNotice ? (
        <Card className={connectionNotice.success ? "border-emerald-500/25 bg-emerald-500/5" : "border-amber-500/25 bg-amber-500/5"}>
          <CardContent className="flex items-start gap-3 text-sm">
            {connectionNotice.success
              ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
              : <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" />}
            <p>{connectionNotice.message}</p>
          </CardContent>
        </Card>
      ) : null}
      {!data.setupReady ? (
        <Card className="border-amber-500/25 bg-amber-500/5">
          <CardContent className="flex items-start gap-3">
            <DatabaseZap aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" />
            <div>
              <p className="font-medium">Database setup required</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Apply the latest Supabase migration, then refresh this page.</p>
              <pre className="mt-3 w-fit rounded-lg bg-background px-3 py-2 text-xs"><code>npx supabase db push</code></pre>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!data.configurationReady ? (
        <Card className="border-amber-500/25 bg-amber-500/5">
          <CardContent className="flex items-start gap-3">
            <KeyRound aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" />
            <div>
              <p className="font-medium">Server credentials required</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Add the Meta Instagram app ID, app secret, redirect URL, and a token-encryption key to the deployment environment.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <InstagramConnectionCard
        canManage={canManage && ready}
        connection={data.connection}
      />

      <Card>
        <CardHeader>
          <CardTitle as="h2">How imports work</CardTitle>
          <CardDescription>Carborony reads only the professional-account media you approve through Meta.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {[
            [CheckCircle2, "Sync posts", "Retrieve recent images, videos, reels, captions, and source links."],
            [AlertTriangle, "Review suggestions", "Caption rules propose product details and flag missing or duplicate information."],
            [CheckCircle2, "Approve manually", "Edit the draft, then add it as a catalogue draft or publish it yourself."],
          ].map(([Icon, title, description]) => (
            <div className="rounded-xl border bg-muted/15 p-4" key={title as string}>
              <Icon aria-hidden="true" className="size-4 text-primary" />
              <p className="mt-3 text-sm font-medium">{title as string}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{description as string}</p>
            </div>
          ))}
          <div className="sm:col-span-3">
            <ButtonLink href="/app/marketing/instagram" variant="outline">
              Open Instagram imports <ArrowUpRight aria-hidden="true" />
            </ButtonLink>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
