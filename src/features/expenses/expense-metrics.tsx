import {
  CalendarDays,
  CircleDollarSign,
  ReceiptText,
  Tags,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { ExpensePageData } from "./types"

function formatMoney(currencyCode: string, amount: number) {
  return new Intl.NumberFormat("en", {
    currency: currencyCode,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(amount)
}

export function ExpenseMetricCards({
  currencyCode,
  metrics,
}: {
  currencyCode: string
  metrics: ExpensePageData["metrics"]
}) {
  const cards = [
    {
      icon: CircleDollarSign,
      label: "Total recorded",
      value: formatMoney(currencyCode, metrics.recordedTotal),
    },
    {
      icon: CalendarDays,
      label: "This month",
      value: formatMoney(currencyCode, metrics.thisMonthTotal),
    },
    {
      icon: ReceiptText,
      label: "Expense entries",
      value: metrics.totalCount.toLocaleString(),
    },
    {
      icon: Tags,
      label: "Top category",
      value: metrics.topCategoryName ?? "No expenses yet",
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <card.icon aria-hidden="true" className="size-4" />
              </span>
            </div>
            <p
              className="mt-4 truncate text-xl font-semibold tracking-tight"
              title={card.value}
            >
              {card.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
