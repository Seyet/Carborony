import Link from "next/link"
import { ArrowDown, ArrowUp, Package } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { InventoryMovement } from "./types"

const movementLabels: Record<string, string> = {
  adjustment: "Stock adjusted",
  damage: "Damaged",
  loss: "Lost",
  opening: "Opening stock",
  purchase: "Stock added",
  removal: "Stock removed",
  return: "Returned",
  sale: "Sale",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
}

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value))
}

function formatQuantity(quantity: number) {
  const absolute = new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(Math.abs(quantity))
  return `${quantity > 0 ? "+" : "−"}${absolute}`
}

export function InventoryHistoryTable({
  items,
  timezone,
}: {
  items: InventoryMovement[]
  timezone: string
}) {
  return (
    <Card className="overflow-hidden py-0 shadow-sm">
      <CardHeader className="border-b py-5">
        <CardTitle as="h2">Stock history</CardTitle>
        <p className="text-sm text-muted-foreground">An immutable record of every stock movement.</p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 sm:pl-6">Product</TableHead>
              <TableHead>Operation</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Recorded by</TableHead>
              <TableHead className="pr-4 sm:pr-6">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((movement) => {
              const positive = movement.quantityDelta > 0
              const Icon = positive ? ArrowUp : ArrowDown
              return (
                <TableRow key={movement.id}>
                  <TableCell className="pl-4 sm:pl-6">
                    <div className="flex min-w-52 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Package aria-hidden="true" className="size-4" /></span>
                      <span>
                        <Link className="block font-medium hover:underline" href={`/app/catalogue/${movement.productId}`}>{movement.productName}</Link>
                        <span className="block text-xs text-muted-foreground">{movement.variantName ? `${movement.variantName} · ` : ""}{movement.productSku ?? "No SKU"}</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{movementLabels[movement.movementType] ?? movement.movementType.replaceAll("_", " ")}</Badge></TableCell>
                  <TableCell className={positive ? "font-semibold text-emerald-700 dark:text-emerald-400" : "font-semibold text-destructive"}><span className="inline-flex items-center gap-1"><Icon aria-hidden="true" className="size-3.5" />{formatQuantity(movement.quantityDelta)}</span></TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(movement.occurredAt, timezone)}</TableCell>
                  <TableCell className="text-muted-foreground">{movement.locationName}</TableCell>
                  <TableCell className="text-muted-foreground">{movement.createdByName}</TableCell>
                  <TableCell className="max-w-64 truncate pr-4 text-muted-foreground sm:pr-6" title={movement.note ?? undefined}>{movement.note ?? "—"}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
