import { AlertTriangle, Boxes, CircleDollarSign, Package, PackageX } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { InventoryMetrics } from "./types"

function formatMoney(currencyCode: string, amount: number) {
  return new Intl.NumberFormat("en", {
    currency: currencyCode,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(amount)
}

function formatQuantity(quantity: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(quantity)
}

export function InventoryMetricCards({
  currencyCode,
  metrics,
}: {
  currencyCode: string
  metrics: InventoryMetrics
}) {
  const cards = [
    { icon: Package, label: "Total products", value: metrics.totalProducts.toLocaleString() },
    { icon: Boxes, label: "Total units", value: formatQuantity(metrics.totalUnits) },
    { icon: CircleDollarSign, label: "Inventory value", value: formatMoney(currencyCode, metrics.inventoryValue) },
    { icon: AlertTriangle, label: "Low stock", tone: "text-amber-700 dark:text-amber-400", value: metrics.lowStockCount.toLocaleString() },
    { icon: PackageX, label: "Out of stock", tone: "text-destructive", value: metrics.outOfStockCount.toLocaleString() },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <span className={`flex size-8 items-center justify-center rounded-lg bg-muted ${card.tone ?? "text-muted-foreground"}`}>
                <card.icon aria-hidden="true" className="size-4" />
              </span>
            </div>
            <p className={`mt-4 truncate text-xl font-semibold tracking-tight ${card.tone ?? ""}`}>{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

