import Image from "next/image"
import {
  Boxes,
  CircleDollarSign,
  ImageIcon,
  Package,
  Pencil,
  Play,
  Tag,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CatalogueCategory, ProductEditorData } from "./types"

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

function getCategoryLabel(categories: CatalogueCategory[], categoryId: string | null) {
  if (!categoryId) return "Uncategorised"

  const category = categories.find((item) => item.id === categoryId)
  if (!category) return "Uncategorised"

  const parent = category.parentId
    ? categories.find((item) => item.id === category.parentId)
    : null

  return parent ? `${parent.name} / ${category.name}` : category.name
}

function stockPresentation(product: ProductEditorData) {
  if (!product.trackInventory) {
    return { label: "Not tracked", tone: "text-muted-foreground" }
  }
  if (product.stockQuantity <= 0) {
    return { label: "Out of stock", tone: "text-destructive" }
  }
  if (product.stockQuantity <= product.lowStockThreshold) {
    return { label: "Low stock", tone: "text-amber-700 dark:text-amber-400" }
  }
  return { label: "In stock", tone: "text-emerald-700 dark:text-emerald-400" }
}

export function ProductDetails({
  categories,
  currencyCode,
  product,
}: {
  categories: CatalogueCategory[]
  currencyCode: string
  product: ProductEditorData
}) {
  const productImages = product.media.filter(
    (media) => media.kind === "image" && media.variantId === null,
  )
  const primaryImage = productImages.find((media) => media.isPrimary) ?? productImages[0]
  const otherImages = productImages.filter((media) => media.id !== primaryImage?.id)
  const videos = product.media.filter((media) => media.kind === "video")
  const stock = stockPresentation(product)

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardContent className="grid grid-cols-[100px_minmax(0,1fr)] items-start gap-4 sm:gap-6">
          <div className="space-y-3">
            <div className="relative flex size-[100px] items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground">
              {primaryImage?.publicUrl ? (
                <Image
                  alt={product.name}
                  className="object-cover"
                  fill
                  priority
                  sizes="100px"
                  src={primaryImage.publicUrl}
                  unoptimized
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-sm">
                  <ImageIcon aria-hidden="true" className="size-10" />
                  No product image
                </div>
              )}
              {primaryImage?.isPrimary ? (
                <Badge className="absolute top-3 left-3" variant="secondary">Primary image</Badge>
              ) : null}
            </div>
            {otherImages.length ? (
              <div className="grid grid-cols-2 gap-2">
                {otherImages.map((media) => (
                  <a
                    aria-label={`Open ${media.fileName}`}
                    className="relative aspect-square overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10 transition-opacity hover:opacity-80"
                    href={media.publicUrl}
                    key={media.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <Image alt="" className="object-cover" fill sizes="96px" src={media.publicUrl} unoptimized />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="capitalize" variant={product.status === "active" ? "default" : "secondary"}>
                {product.status}
              </Badge>
              <span className="text-xs text-muted-foreground">{product.sku ?? "No SKU"}</span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{getCategoryLabel(categories, product.categoryId)}</p>

            <div className="mt-6 flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-semibold">
                {formatMoney(currencyCode, product.discountPrice ?? product.sellingPrice)}
              </span>
              {product.discountPrice !== null ? (
                <span className="text-base text-muted-foreground line-through">
                  {formatMoney(currencyCode, product.sellingPrice)}
                </span>
              ) : null}
            </div>

            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <dt className="flex items-center gap-2 text-xs text-muted-foreground"><CircleDollarSign aria-hidden="true" className="size-4" />Cost price</dt>
                <dd className="mt-2 font-medium">{formatMoney(currencyCode, product.costPrice)}</dd>
              </div>
              <div className="rounded-xl border p-4">
                <dt className="flex items-center gap-2 text-xs text-muted-foreground"><Boxes aria-hidden="true" className="size-4" />Stock</dt>
                <dd className={`mt-2 font-medium ${stock.tone}`}>
                  {product.trackInventory ? `${formatQuantity(product.stockQuantity)} · ${stock.label}` : stock.label}
                </dd>
              </div>
              <div className="rounded-xl border p-4">
                <dt className="text-xs text-muted-foreground">Low-stock threshold</dt>
                <dd className="mt-2 font-medium">{product.trackInventory ? formatQuantity(product.lowStockThreshold) : "Not applicable"}</dd>
              </div>
              <div className="rounded-xl border p-4">
                <dt className="text-xs text-muted-foreground">Variants</dt>
                <dd className="mt-2 font-medium">{product.variants.length}</dd>
              </div>
            </dl>

            <ButtonLink className="mt-6 w-full sm:w-fit" href={`/app/catalogue/${product.id}/edit`}>
              <Pencil aria-hidden="true" />Edit product
            </ButtonLink>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle as="h2">Description</CardTitle></CardHeader>
          <CardContent>
            {product.description ? (
              <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{product.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No description has been added.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle as="h2">Product tags</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {product.tags.length ? product.tags.map((tag) => (
              <Badge key={tag} variant="outline"><Tag aria-hidden="true" />{tag}</Badge>
            )) : <p className="text-sm text-muted-foreground">No tags have been added.</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b py-4">
          <CardTitle as="h2">Product variants</CardTitle>
          <p className="text-sm text-muted-foreground">Variant pricing, attributes, and stock levels.</p>
        </CardHeader>
        <CardContent className="p-0">
          {product.variants.length ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4 sm:pl-6">Variant</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="pr-4 sm:pr-6">Low-stock level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.variants.map((variant) => {
                  const variantImage = product.media.find((media) => media.variantId === variant.id && media.kind === "image")
                  return (
                    <TableRow key={variant.id}>
                      <TableCell className="pl-4 sm:pl-6">
                        <div className="flex min-w-52 items-center gap-3">
                          <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                            {variantImage?.publicUrl ? <Image alt="" className="object-cover" fill sizes="40px" src={variantImage.publicUrl} unoptimized /> : <Package aria-hidden="true" className="size-4" />}
                          </span>
                          <span>
                            <span className="block font-medium">{variant.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {variant.attributes.length
                                ? variant.attributes.map((attribute) => `${attribute.name}: ${attribute.value}`).join(" · ")
                                : "No attributes"}
                            </span>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{variant.sku ?? "—"}</TableCell>
                      <TableCell>{formatMoney(currencyCode, variant.sellingPrice)}</TableCell>
                      <TableCell>{formatMoney(currencyCode, variant.costPrice)}</TableCell>
                      <TableCell>{formatQuantity(variant.stockQuantity)}</TableCell>
                      <TableCell className="pr-4 sm:pr-6">{formatQuantity(variant.lowStockThreshold)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-muted-foreground">
              <Package aria-hidden="true" className="size-8" />
              <p className="text-sm">This product has no variants.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {videos.length ? (
        <Card>
          <CardHeader><CardTitle as="h2">Product videos</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((media) => (
              <a className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50" href={media.publicUrl} key={media.id} rel="noreferrer" target="_blank">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Play aria-hidden="true" className="size-4" /></span>
                <span className="min-w-0"><span className="block truncate font-medium">{media.fileName}</span><span className="block text-xs text-muted-foreground">Open video</span></span>
              </a>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
