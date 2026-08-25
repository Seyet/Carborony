import type { Metadata } from "next"
import Form from "next/form"
import { ChevronLeft, ChevronRight, PackageOpen, Plus, Search, X } from "lucide-react"
import { z } from "zod"

import { EmptyState } from "@/components/common"
import { Button, ButtonLink } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CatalogueSetupRequired } from "@/features/catalogue/catalogue-setup-required"
import { CatalogueTable } from "@/features/catalogue/catalogue-table"
import { CategoryManager } from "@/features/catalogue/category-manager"
import {
  CatalogueSetupRequiredError,
  cataloguePageSize,
  getCatalogue,
} from "@/features/catalogue/server/get-catalogue"
import type { CatalogueResult } from "@/features/catalogue/types"

export const metadata: Metadata = { title: "Catalogue" }

type CataloguePageProps = {
  searchParams: Promise<{
    category?: string | string[]
    page?: string | string[]
    query?: string | string[]
    status?: string | string[]
  }>
}

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

function catalogueHref(
  page: number,
  filters: { categoryId: string; query: string; status: string },
) {
  const params = new URLSearchParams()
  if (filters.query) params.set("query", filters.query)
  if (filters.status) params.set("status", filters.status)
  if (filters.categoryId) params.set("category", filters.categoryId)
  if (page > 1) params.set("page", String(page))
  const queryString = params.toString()
  return `/app/catalogue${queryString ? `?${queryString}` : ""}`
}

export default async function CataloguePage({ searchParams }: CataloguePageProps) {
  const params = await searchParams
  const rawPage = Number(firstValue(params.page))
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const query = (firstValue(params.query) ?? "").trim().slice(0, 100)
  const rawStatus = firstValue(params.status) ?? ""
  const status = z.enum(["active", "archived", "draft"]).safeParse(rawStatus).success
    ? rawStatus
    : ""
  const rawCategory = firstValue(params.category) ?? ""
  const categoryId = z.uuid().safeParse(rawCategory).success ? rawCategory : ""
  let catalogue: CatalogueResult | null = null
  let setupRequired = false

  try {
    catalogue = await getCatalogue({ categoryId, page, query, status })
  } catch (error) {
    if (error instanceof CatalogueSetupRequiredError) setupRequired = true
    else throw error
  }

  if (setupRequired || !catalogue) return <CatalogueSetupRequired />

  const hasFilters = Boolean(query || status || categoryId)
  const filters = { categoryId, query, status }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Business / Catalogue</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Product catalogue</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage products, pricing, stock, variants, categories, images, and videos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CategoryManager categories={catalogue.categories} />
          <ButtonLink href="/app/catalogue/new"><Plus aria-hidden="true" />Add product</ButtonLink>
        </div>
      </header>

      <Form action="/app/catalogue" className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[minmax(260px,1fr)_180px_220px_auto_auto]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-10 pl-9" defaultValue={query} maxLength={100} name="query" placeholder="Search name, SKU, description or tag" type="search" />
        </div>
        <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" defaultValue={status} name="status">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" defaultValue={categoryId} name="category">
          <option value="">All categories</option>
          {catalogue.categories.filter((category) => category.isActive).map((category) => {
            const parent = category.parentId
              ? catalogue.categories.find((item) => item.id === category.parentId)
              : null
            return <option key={category.id} value={category.id}>{parent ? `${parent.name} / ` : ""}{category.name}</option>
          })}
        </select>
        <Button className="h-10" type="submit"><Search aria-hidden="true" />Filter</Button>
        {hasFilters ? <ButtonLink className="h-10" href="/app/catalogue" variant="outline"><X aria-hidden="true" />Clear</ButtonLink> : null}
      </Form>

      {catalogue.items.length ? (
        <>
          <CatalogueTable currencyCode={catalogue.currencyCode} items={catalogue.items} />
          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>Showing {(catalogue.page - 1) * cataloguePageSize + 1}–{Math.min(catalogue.page * cataloguePageSize, catalogue.totalCount)} of {catalogue.totalCount} products</p>
            <div className="flex items-center gap-2">
              {catalogue.page > 1 ? (
                <ButtonLink href={catalogueHref(catalogue.page - 1, filters)} size="sm" variant="outline"><ChevronLeft aria-hidden="true" />Previous</ButtonLink>
              ) : (
                <Button disabled size="sm" variant="outline"><ChevronLeft aria-hidden="true" />Previous</Button>
              )}
              <span className="px-2">Page {catalogue.page} of {catalogue.pageCount}</span>
              {catalogue.page < catalogue.pageCount ? (
                <ButtonLink href={catalogueHref(catalogue.page + 1, filters)} size="sm" variant="outline">Next<ChevronRight aria-hidden="true" /></ButtonLink>
              ) : (
                <Button disabled size="sm" variant="outline">Next<ChevronRight aria-hidden="true" /></Button>
              )}
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          action={hasFilters
            ? <ButtonLink href="/app/catalogue" variant="outline">Clear filters</ButtonLink>
            : <ButtonLink href="/app/catalogue/new"><Plus aria-hidden="true" />Add your first product</ButtonLink>}
          description={hasFilters ? "Try changing your search or catalogue filters." : "Create products with prices, stock, variants, images, and videos."}
          icon={PackageOpen}
          title={hasFilters ? "No matching products" : "Your catalogue is empty"}
        />
      )}
    </div>
  )
}
