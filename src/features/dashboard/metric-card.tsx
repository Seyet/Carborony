import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

import type { DashboardMetric, MetricTone } from "./dashboard-data"

const toneStyles: Record<
  MetricTone,
  { icon: string; helper: string; trend: "up" | "down" | null }
> = {
  positive: {
    icon: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    helper: "text-emerald-700 dark:text-emerald-400",
    trend: "up",
  },
  neutral: {
    icon: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    helper: "text-muted-foreground",
    trend: null,
  },
  warning: {
    icon: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    helper: "text-amber-700 dark:text-amber-400",
    trend: null,
  },
  danger: {
    icon: "bg-destructive/10 text-destructive",
    helper: "text-destructive",
    trend: "down",
  },
}

export function MetricCard({ metric }: { metric: DashboardMetric }) {
  const Icon = metric.icon
  const styles = toneStyles[metric.tone]

  return (
    <Card className="border-0 py-0 shadow-sm ring-1 ring-foreground/8 transition-shadow hover:shadow-md">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">
              {metric.title}
            </p>
            <p className="mt-2 text-lg font-semibold tracking-tight tabular-nums min-[420px]:text-xl sm:text-2xl">
              {metric.value}
            </p>
          </div>
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10",
              styles.icon
            )}
          >
            <Icon className="size-4 sm:size-[18px]" aria-hidden="true" />
          </span>
        </div>
        <p
          className={cn(
            "mt-3 flex items-center gap-1 text-[11px] leading-4 sm:text-xs",
            styles.helper
          )}
        >
          {styles.trend === "up" ? (
            <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
          ) : null}
          {styles.trend === "down" ? (
            <ArrowDownRight
              className="size-3.5 shrink-0"
              aria-hidden="true"
            />
          ) : null}
          <span className="truncate">{metric.helper}</span>
        </p>
      </CardContent>
    </Card>
  )
}
