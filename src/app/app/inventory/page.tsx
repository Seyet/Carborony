import type { Metadata } from "next"
import Form from "next/form"
import Link from "next/link"
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  History,
  PackagePlus,
  Search,
  X,
} from "lucide-react"

import { EmptyState } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InventoryHistoryTable } from "@/features/inventory/inventory-history-table"
import { InventoryMetricCards } from "@/features/inventory/inventory-metrics"
import { InventoryProductsTable } from "@/features/inventory/inventory-products-table"
import { InventorySetupRequired } from "@/features/inventory/inventory-setup-required"
import {
  getInventory,
  inventoryPageSize,
  InventorySetupRequiredError,
} from "@/features/inventory/server/get-inventory"
import type { InventoryView } from "@/features/inventory/types"

export const metadata: Metadata = { title: "Inventory" }

const stockStatuses = ["in_stock", "low_stock", "out_of_stock", "untracked"] as const
const movementTypes = [
  "opening",
  "purchase",
  "sale",
  "return",
  "adjustment",
  "damage",
  "removal",
  "loss",
  "transfer_in",
  "transfer_out",
] as const

type InventoryPageProps = {
  searchParams: Promise<{
    movement?: string | string[]
    page?: string | string[]
    query?: string | string[]
    stock?: string | string[]
    view?: string | string[]
  }>
}

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

function inventoryHref({
  movementType,
  page,
  query,
  stockStatus,
  view,
}: {
  movementType: string
  page: number
  query: string
  stockStatus: string
  view: InventoryView
}) {
  const params = new URLSearchParams()
  if (view === "history") params.set("view", view)
  if (query) params.set("query", query)
  if (view === "stock" && stockStatus) params.set("stock", stockStatus)
  if (view === "history" && movementType) params.set("movement", movementType)
  if (page > 1) params.set("page", String(page))
  const queryString = params.toString()
  return `/app/inventory${queryString ? `?${queryString}` : ""}`
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const params = await searchParams
  const view: InventoryView = first(params.view) === "history" ? "history" : "stock"
  const parsedPage = Number(first(params.page))
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const query = (first(params.query) ?? "").trim().slice(0, 100)
  const requestedStockStatus = first(params.stock) ?? ""
  const stockStatus = stockStatuses.some((status) => status === requestedStockStatus)
    ? requestedStockStatus
    : ""
  const requestedMovementType = first(params.movement) ?? ""
  const movementType = movementTypes.some((type) => type === requestedMovementType)
    ? requestedMovementType
    : ""

  let inventory: Awaited<ReturnType<typeof getInventory>> | null = null
  try {
    inventory = await getInventory({ movementType, page, query, stockStatus, view })
  } catch (error) {
    if (!(error instanceof InventorySetupRequiredError)) throw error
  }

  if (!inventory) return <InventorySetupRequired />

  const hasFilters = Boolean(query || (view === "stock" ? stockStatus : movementType))
  const previousHref = inventoryHref({ movementType, page: inventory.page - 1, query, stockStatus, view })
  const nextHref = inventoryHref({ movementType, page: inventory.page + 1, query, stockStatus, view })
  const itemCount = view === "stock" ? inventory.items.length : inventory.movements.length

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Operations / Inventory</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">Monitor stock levels, inventory value, and every stock movement.</p>
        </div>
        <Button render={<Link href="/app/catalogue/new" />}><PackagePlus aria-hidden="true" />Add product</Button>
      </header>

      <InventoryMetricCards currencyCode={inventory.currencyCode} metrics={inventory.metrics} />

      <div className="flex w-fit rounded-lg bg-muted p-[3px]">
        <Button aria-current={view === "stock" ? "page" : undefined} className="h-8" render={<Link href="/app/inventory" />} size="sm" variant={view === "stock" ? "secondary" : "ghost"}><Boxes aria-hidden="true" />Stock</Button>
        <Button aria-current={view === "history" ? "page" : undefined} className="h-8" render={<Link href="/app/inventory?view=history" />} size="sm" variant={view === "history" ? "secondary" : "ghost"}><History aria-hidden="true" />History</Button>
      </div>

      <Form action="/app/inventory" className="flex flex-col gap-2 lg:flex-row">
        {view === "history" ? <input name="view" type="hidden" value="history" /> : null}
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-10 pl-9" defaultValue={query} maxLength={100} name="query" placeholder={view === "stock" ? "Search product, SKU, or category" : "Search product, SKU, notes, location, or user"} type="search" />
        </div>
        {view === "stock" ? (
          <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" defaultValue={stockStatus} name="stock">
            <option value="">All stock statuses</option>
            <option value="in_stock">In stock</option>
            <option value="low_stock">Low stock</option>
            <option value="out_of_stock">Out of stock</option>
            <option value="untracked">Not tracked</option>
          </select>
        ) : (
          <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" defaultValue={movementType} name="movement">
            <option value="">All movement types</option>
            <option value="opening">Opening stock</option>
            <option value="purchase">Stock added</option>
            <option value="sale">Sale</option>
            <option value="return">Returned</option>
            <option value="adjustment">Adjusted</option>
            <option value="damage">Damaged</option>
            <option value="removal">Removed</option>
            <option value="loss">Lost</option>
            <option value="transfer_in">Transfer in</option>
            <option value="transfer_out">Transfer out</option>
          </select>
        )}
        <Button className="h-10" type="submit"><Search aria-hidden="true" />Filter</Button>
        {hasFilters ? <Button className="h-10" render={<Link href={view === "history" ? "/app/inventory?view=history" : "/app/inventory"} />} type="button" variant="outline"><X aria-hidden="true" />Clear</Button> : null}
      </Form>

      {itemCount ? (
        <>
          {view === "stock"
            ? <InventoryProductsTable currencyCode={inventory.currencyCode} items={inventory.items} />
            : <InventoryHistoryTable items={inventory.movements} timezone={inventory.timezone} />}
          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>Showing {(inventory.page - 1) * inventoryPageSize + 1}–{Math.min(inventory.page * inventoryPageSize, inventory.totalCount)} of {inventory.totalCount} {view === "stock" ? "products" : "movements"}</p>
            <div className="flex items-center gap-2">
              <Button disabled={inventory.page <= 1} render={inventory.page > 1 ? <Link href={previousHref} /> : undefined} size="sm" variant="outline"><ChevronLeft aria-hidden="true" />Previous</Button>
              <span className="px-2">Page {inventory.page} of {inventory.pageCount}</span>
              <Button disabled={inventory.page >= inventory.pageCount} render={inventory.page < inventory.pageCount ? <Link href={nextHref} /> : undefined} size="sm" variant="outline">Next<ChevronRight aria-hidden="true" /></Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          action={hasFilters
            ? <Button render={<Link href={view === "history" ? "/app/inventory?view=history" : "/app/inventory"} />} variant="outline">Clear filters</Button>
            : view === "stock" ? <Button render={<Link href="/app/catalogue/new" />}>Add a product</Button> : undefined}
          description={hasFilters
            ? "No inventory records match the selected filters."
            : view === "stock" ? "Products added to the catalogue will appear here." : "Stock movements will appear after inventory operations or sales."}
          icon={view === "stock" ? Boxes : History}
          title={hasFilters ? "No matching inventory" : view === "stock" ? "No products yet" : "No stock history yet"}
        />
      )}
    </div>
  )
}

