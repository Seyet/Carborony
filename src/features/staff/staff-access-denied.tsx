import { ShieldX } from "lucide-react"

import { ButtonLink } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function StaffAccessDenied() {
  return (
    <div className="mx-auto flex min-h-[60svh] max-w-2xl items-center justify-center">
      <Card className="w-full">
        <CardContent className="flex flex-col items-center px-6 py-10 text-center sm:px-10">
          <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <ShieldX aria-hidden="true" className="size-5" />
          </span>
          <h1 className="mt-4 text-xl font-semibold">Staff access is restricted</h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            Only the business owner or an administrator can view and manage employees.
          </p>
          <ButtonLink className="mt-6" href="/app/dashboard" variant="outline">
            Return to dashboard
          </ButtonLink>
        </CardContent>
      </Card>
    </div>
  )
}
