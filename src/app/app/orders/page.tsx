import type { Metadata } from "next"
import Form from "next/form"
import Link from "next/link"
import { ChevronLeft, ChevronRight, ClipboardList, Plus, Search, X } from "lucide-react"

import { EmptyState } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OrderMetricCards } from "@/features/orders/order-metrics"
import { OrdersSetupRequired } from "@/features/orders/orders-setup-required"
import { OrdersTable } from "@/features/orders/orders-table"
import { getOrders, ordersPageSize, OrdersSetupRequiredError } from "@/features/orders/server/get-orders"

export const metadata: Metadata = { title: "Orders" }

const statuses = ["pending", "confirmed", "processing", "ready", "completed", "cancelled", "refunded"] as const
const channels = ["manual", "pos", "storefront", "instagram", "whatsapp"] as const

type OrdersPageProps = {
  searchParams: Promise<{
    channel?: string | string[]
    page?: string | string[]
    query?: string | string[]
    status?: string | string[]
  }>
}

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

function ordersHref(page: number, query: string, status: string, channel: string) {
  const params = new URLSearchParams()
  if (query) params.set("query", query)
  if (status) params.set("status", status)
  if (channel) params.set("channel", channel)
  if (page > 1) params.set("page", String(page))
  const queryString = params.toString()
  return `/app/orders${queryString ? `?${queryString}` : ""}`
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams
  const parsedPage = Number(first(params.page))
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const query = (first(params.query) ?? "").trim().slice(0, 100)
  const requestedStatus = first(params.status) ?? ""
  const status = statuses.some((item) => item === requestedStatus) ? requestedStatus : ""
  const requestedChannel = first(params.channel) ?? ""
  const channel = channels.some((item) => item === requestedChannel) ? requestedChannel : ""

  let orders: Awaited<ReturnType<typeof getOrders>> | null = null
  try {
    orders = await getOrders({ channel, page, query, status })
  } catch (error) {
    if (!(error instanceof OrdersSetupRequiredError)) throw error
  }

  if (!orders) return <OrdersSetupRequired />
  const hasFilters = Boolean(query || status || channel)

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs text-muted-foreground">Commerce / Orders</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Orders</h1><p className="mt-1 text-sm text-muted-foreground">Track and fulfil orders across every sales channel.</p></div>
        <Button render={<Link href="/app/orders/new" />}><Plus aria-hidden="true" />Create order</Button>
      </header>

      <OrderMetricCards metrics={orders.metrics} />

      <Form action="/app/orders" className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto_auto]">
        <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-10 pl-9" defaultValue={query} maxLength={100} name="query" placeholder="Search number, buyer, phone, channel, or status" type="search" /></div>
        <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" defaultValue={status} name="status"><option value="">All statuses</option>{statuses.map((item) => <option className="capitalize" key={item} value={item}>{item}</option>)}</select>
        <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" defaultValue={channel} name="channel"><option value="">All channels</option>{channels.map((item) => <option className="capitalize" key={item} value={item}>{item}</option>)}</select>
        <Button className="h-10" type="submit"><Search aria-hidden="true" />Filter</Button>
        {hasFilters ? <Button className="h-10" render={<Link href="/app/orders" />} type="button" variant="outline"><X aria-hidden="true" />Clear</Button> : null}
      </Form>

      {orders.items.length ? (
        <>
          <OrdersTable items={orders.items} timezone={orders.timezone} />
          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>Showing {(orders.page - 1) * ordersPageSize + 1}–{Math.min(orders.page * ordersPageSize, orders.totalCount)} of {orders.totalCount} orders</p>
            <div className="flex items-center gap-2"><Button disabled={orders.page <= 1} render={orders.page > 1 ? <Link href={ordersHref(orders.page - 1, query, status, channel)} /> : undefined} size="sm" variant="outline"><ChevronLeft aria-hidden="true" />Previous</Button><span className="px-2">Page {orders.page} of {orders.pageCount}</span><Button disabled={orders.page >= orders.pageCount} render={orders.page < orders.pageCount ? <Link href={ordersHref(orders.page + 1, query, status, channel)} /> : undefined} size="sm" variant="outline">Next<ChevronRight aria-hidden="true" /></Button></div>
          </div>
        </>
      ) : (
        <EmptyState action={hasFilters ? <Button render={<Link href="/app/orders" />} variant="outline">Clear filters</Button> : <Button render={<Link href="/app/orders/new" />}>Create an order</Button>} description={hasFilters ? "No orders match the selected filters." : "New orders will appear here when they are created manually or received from a connected channel."} icon={ClipboardList} title={hasFilters ? "No matching orders" : "No orders yet"} />
      )}
    </div>
  )
}

