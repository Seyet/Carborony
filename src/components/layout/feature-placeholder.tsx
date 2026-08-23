import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ArrowRight, CheckCircle2, Construction } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

type FeaturePlaceholderProps = {
  title: string
  description: string
  route: string
  icon: LucideIcon
}

export function FeaturePlaceholder({
  title,
  description,
  route,
  icon: Icon,
}: FeaturePlaceholderProps) {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Link
              href="/app/dashboard"
              className="transition-colors hover:text-foreground"
            >
              Workspace
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-foreground">{title}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <Badge variant="secondary" className="w-fit gap-1.5">
          <Construction aria-hidden="true" />
          Foundation only
        </Badge>
      </header>

      <Card className="min-h-[440px] justify-center border-0 bg-card shadow-sm ring-1 ring-foreground/8">
        <CardContent className="mx-auto flex max-w-xl flex-col items-center py-14 text-center sm:py-20">
          <div className="relative mb-6">
            <span className="absolute inset-0 scale-150 rounded-full bg-primary/5" />
            <span className="relative flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
              <Icon className="size-7" aria-hidden="true" />
            </span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight">
            {title} workspace is ready
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This route is part of the production foundation. The business flows,
            data, and permissions for this module will be added incrementally.
          </p>

          <div className="mt-7 flex w-full max-w-md flex-col gap-2 rounded-xl border bg-muted/30 p-3 text-left sm:flex-row sm:items-center">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-muted-foreground">
                Reserved route
              </span>
              <code className="block truncate text-sm font-medium text-foreground">
                {route}
              </code>
            </span>
            <Link
              href="/app/dashboard"
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Dashboard
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
