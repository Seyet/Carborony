import Image from "next/image"
import Link from "next/link"
import { Eye, ImageIcon, Shapes } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CatalogueListItem } from "./types"

function formatMoney(currencyCode: string, amount: number) {
  return new Intl.NumberFormat("en", {
    currency: currencyCode,
    currencyDisplay: "narrowSymbol",
    style: "currency",
  }).format(amount)
}

function stockLabel(product: CatalogueListItem) {
  if (product.stockQuantity === null) return { className: "text-muted-foreground", text: "Not tracked" }
  if (product.stockQuantity <= 0) return { className: "text-destructive", text: "Out of stock" }
  if (product.stockQuantity <= product.lowStockThreshold) {
    return { className: "text-amber-700 dark:text-amber-400", text: `${product.stockQuantity} low stock` }
  }
  return { className: "text-emerald-700 dark:text-emerald-400", text: `${product.stockQuantity} in stock` }
}

export function CatalogueTable({
  currencyCode,
  items,
}: {
  currencyCode: string
  items: CatalogueListItem[]
}) {
  return (
    <Card className="overflow-hidden py-0 shadow-sm">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 sm:pl-6">Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Variants</TableHead>
              <TableHead className="pr-4 text-right sm:pr-6">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((product) => {
              const stock = stockLabel(product)
              return (
                <TableRow key={product.id}>
                  <TableCell className="pl-4 sm:pl-6">
                    <div className="flex min-w-56 items-center gap-3">
                      <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                        {product.imageUrl ? (
                          <Image alt="" className="object-cover" fill sizes="44px" src={product.imageUrl} unoptimized />
                        ) : <ImageIcon aria-hidden="true" className="size-5" />}
                      </span>
                      <span>
                        <Link className="block font-medium hover:underline" href={`/app/catalogue/${product.id}`}>{product.name}</Link>
                        <span className="block text-xs text-muted-foreground">{product.sku ?? "No SKU"}</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{product.categoryName ?? "Uncategorised"}</TableCell>
                  <TableCell>
                    <span className="font-medium">{formatMoney(currencyCode, product.discountPrice ?? product.sellingPrice)}</span>
                    {product.discountPrice !== null ? <span className="ml-2 text-xs text-muted-foreground line-through">{formatMoney(currencyCode, product.sellingPrice)}</span> : null}
                  </TableCell>
                  <TableCell className={stock.className}>{stock.text}</TableCell>
                  <TableCell><Badge className="capitalize" variant={product.status === "active" ? "default" : "secondary"}>{product.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Shapes aria-hidden="true" className="size-4" />{product.variantCount}</span></TableCell>
                  <TableCell className="pr-4 text-right sm:pr-6">
                    <ButtonLink href={`/app/catalogue/${product.id}`} size="sm" variant="outline"><Eye aria-hidden="true" />View</ButtonLink>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
