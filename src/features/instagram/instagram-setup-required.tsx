import { Camera, DatabaseZap } from "lucide-react"

import { ButtonLink } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function InstagramSetupRequired() {
  return (
    <div className="mx-auto flex min-h-[60svh] max-w-2xl items-center justify-center">
      <Card className="w-full">
        <CardContent className="flex flex-col items-center px-6 py-10 text-center sm:px-10">
          <span className="flex size-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <DatabaseZap aria-hidden="true" className="size-5" />
          </span>
          <h1 className="mt-4 text-xl font-semibold">Instagram setup required</h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            Apply the Instagram catalogue migration before connecting an account or importing posts.
          </p>
          <pre className="mt-5 overflow-x-auto rounded-lg bg-muted px-4 py-3 text-xs text-foreground"><code>npx supabase db push</code></pre>
          <ButtonLink className="mt-6" href="/app/settings?section=integrations" variant="outline">
            <Camera aria-hidden="true" />Open integrations
          </ButtonLink>
        </CardContent>
      </Card>
    </div>
  )
}
