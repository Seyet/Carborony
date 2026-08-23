import Image from "next/image"
import Link from "next/link"
import { ImageIcon } from "lucide-react"

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
import { StockOperationDialog } from "./stock-operation-dialog"
import type { InventoryProduct } from "./types"

function formatMoney(currencyCode: string, amount: number) {
  return new Intl.NumberFormat("en", {
    currency: currencyCode,
    currencyDisplay: "narrowSymbol",
    style: "currency",
  }).format(amount)
}

function formatQuantity(quantity: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(quantity)
}

function stockStatus(product: InventoryProduct) {
  if (!product.trackInventory) return { label: "Not tracked", variant: "outline" as const }
  if (product.stockQuantity <= 0) return { className: "bg-destructive/10 text-destructive", label: "Out of stock", variant: "secondary" as const }
  if (product.stockQuantity <= product.lowStockThreshold) return { className: "bg-amber-500/10 text-amber-700 dark:text-amber-400", label: "Low stock", variant: "secondary" as const }
  return { className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", label: "In stock", variant: "secondary" as const }
}

export function InventoryProductsTable({
  currencyCode,
  items,
}: {
  currencyCode: string
  items: InventoryProduct[]
}) {
  return (
    <Card className="overflow-hidden py-0 shadow-sm">
      <CardHeader className="border-b py-5">
        <CardTitle as="h2">Product stock</CardTitle>
        <p className="text-sm text-muted-foreground">Current stock and inventory value across the business.</p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 sm:pl-6">Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Threshold</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="pr-4 text-right sm:pr-6">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((product) => {
              const status = stockStatus(product)
              return (
                <TableRow key={product.id}>
                  <TableCell className="pl-4 sm:pl-6">
                    <div className="flex min-w-56 items-center gap-3">
                      <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                        {product.imageUrl ? <Image alt="" className="object-cover" fill sizes="40px" src={product.imageUrl} unoptimized /> : <ImageIcon aria-hidden="true" className="size-4" />}
                      </span>
                      <span>
                        <Link className="block font-medium hover:underline" href={`/app/catalogue/${product.id}`}>{product.name}</Link>
                        <span className="block text-xs text-muted-foreground">{product.sku ?? "No SKU"}</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{product.categoryName ?? "Uncategorised"}</TableCell>
                  <TableCell className="font-medium">{product.trackInventory ? formatQuantity(product.stockQuantity) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{product.trackInventory ? formatQuantity(product.lowStockThreshold) : "—"}</TableCell>
                  <TableCell><Badge className={status.className} variant={status.variant}>{status.label}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(currencyCode, product.inventoryValue)}</TableCell>
                  <TableCell className="pr-4 text-right sm:pr-6"><StockOperationDialog product={product} /></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

