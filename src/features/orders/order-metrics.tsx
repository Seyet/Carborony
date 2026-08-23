import { CheckCircle2, CircleDot, ClipboardList, CookingPot, PackageCheck } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { OrderMetrics } from "./types"

export function OrderMetricCards({ metrics }: { metrics: OrderMetrics }) {
  const cards = [
    { icon: ClipboardList, label: "Total orders", value: metrics.total },
    { icon: CircleDot, label: "Pending", tone: "text-amber-700 dark:text-amber-400", value: metrics.pending },
    { icon: CookingPot, label: "Processing", tone: "text-violet-700 dark:text-violet-400", value: metrics.processing },
    { icon: PackageCheck, label: "Ready", tone: "text-blue-700 dark:text-blue-400", value: metrics.ready },
    { icon: CheckCircle2, label: "Completed", tone: "text-emerald-700 dark:text-emerald-400", value: metrics.completed },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label}><CardContent><div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{card.label}</p><span className={`flex size-8 items-center justify-center rounded-lg bg-muted ${card.tone ?? "text-muted-foreground"}`}><card.icon aria-hidden="true" className="size-4" /></span></div><p className={`mt-4 text-xl font-semibold ${card.tone ?? ""}`}>{card.value.toLocaleString()}</p></CardContent></Card>
      ))}
    </div>
  )
}

