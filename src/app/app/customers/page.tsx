import type { Metadata } from "next"
import Form from "next/form"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Plus, Search, Users, X } from "lucide-react"

import { EmptyState } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { customerSegmentLabels } from "@/features/customers/customer-segment"
import { CustomerSegmentCards } from "@/features/customers/customer-segment-cards"
import { CustomersSetupRequired } from "@/features/customers/customers-setup-required"
import { CustomersTable } from "@/features/customers/customers-table"
import { CustomersSetupRequiredError, customersPageSize, getCustomers } from "@/features/customers/server/customers"
import { customerSegments } from "@/features/customers/types"

export const metadata: Metadata = { title: "Customers" }

type CustomersPageProps = { searchParams: Promise<{ page?: string | string[]; query?: string | string[]; segment?: string | string[] }> }

function first(value?: string | string[]) { return Array.isArray(value) ? value[0] : value }

function customersHref(page: number, query: string, segment: string) {
  const params = new URLSearchParams()
  if (query) params.set("query", query)
  if (segment) params.set("segment", segment)
  if (page > 1) params.set("page", String(page))
  const queryString = params.toString()
  return `/app/customers${queryString ? `?${queryString}` : ""}`
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = await searchParams
  const parsedPage = Number(first(params.page))
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const query = (first(params.query) ?? "").trim().slice(0, 100)
  const requestedSegment = first(params.segment) ?? ""
  const segment = customerSegments.some((item) => item === requestedSegment) ? requestedSegment : ""
  let customers: Awaited<ReturnType<typeof getCustomers>> | null = null
  try { customers = await getCustomers({ page, query, segment }) } catch (error) {
    if (!(error instanceof CustomersSetupRequiredError)) throw error
  }
  if (!customers) return <CustomersSetupRequired />
  const hasFilters = Boolean(query || segment)

  return <div className="space-y-6"><header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs text-muted-foreground">CRM / Customers</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Customers</h1><p className="mt-1 text-sm text-muted-foreground">Understand every customer relationship and purchase history.</p></div><Button render={<Link href="/app/customers/new" />}><Plus aria-hidden="true" />Add customer</Button></header>
    <CustomerSegmentCards currencyCode={customers.currencyCode} metrics={customers.segmentMetrics} />
    <Form action="/app/customers" className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_220px_auto_auto]"><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-10 pl-9" defaultValue={query} maxLength={100} name="query" placeholder="Search name, phone, email, address, or tag" type="search" /></div><select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" defaultValue={segment} name="segment"><option value="">All segments</option>{customerSegments.map((item) => <option key={item} value={item}>{customerSegmentLabels[item]}</option>)}</select><Button className="h-10" type="submit"><Search aria-hidden="true" />Filter</Button>{hasFilters ? <Button className="h-10" render={<Link href="/app/customers" />} type="button" variant="outline"><X aria-hidden="true" />Clear</Button> : null}</Form>
    {customers.items.length ? <><CustomersTable currencyCode={customers.currencyCode} items={customers.items} timezone={customers.timezone} /><div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><p>Showing {(customers.page - 1) * customersPageSize + 1}–{Math.min(customers.page * customersPageSize, customers.totalCount)} of {customers.totalCount} customers</p><div className="flex items-center gap-2"><Button disabled={customers.page <= 1} render={customers.page > 1 ? <Link href={customersHref(customers.page - 1, query, segment)} /> : undefined} size="sm" variant="outline"><ChevronLeft aria-hidden="true" />Previous</Button><span className="px-2">Page {customers.page} of {customers.pageCount}</span><Button disabled={customers.page >= customers.pageCount} render={customers.page < customers.pageCount ? <Link href={customersHref(customers.page + 1, query, segment)} /> : undefined} size="sm" variant="outline">Next<ChevronRight aria-hidden="true" /></Button></div></div></> : <EmptyState action={hasFilters ? <Button render={<Link href="/app/customers" />} variant="outline">Clear filters</Button> : <Button render={<Link href="/app/customers/new" />}>Add customer</Button>} description={hasFilters ? "No customers match the selected filters." : "Customers created here or captured from sales and orders will appear in this directory."} icon={Users} title={hasFilters ? "No matching customers" : "No customers yet"} />}
  </div>
}
