import Link from "next/link"
import {
  ArrowRight,
  Boxes,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Package,
  PackageX,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { DashboardMetric } from "./dashboard-data"
import { DashboardDateFilter } from "./dashboard-date-filter"
import { DashboardExportButton } from "./dashboard-export-button"
import type { DashboardData } from "./server/get-dashboard"
import { MetricCard } from "./metric-card"

function money(currencyCode: string, value: number, locale: string, compact = false) {
  return new Intl.NumberFormat(locale, {
    currency: currencyCode,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: compact ? 1 : 2,
    notation: compact ? "compact" : "standard",
    style: "currency",
  }).format(value)
}

function integer(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value)
}

function relativeChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "No change from previous period" : "New in this period"
  const percentage = ((current - previous) / Math.abs(previous)) * 100
  return `${percentage >= 0 ? "+" : ""}${percentage.toFixed(1)}% from previous period`
}

function metricTone(current: number, previous: number, fallback: DashboardMetric["tone"] = "neutral") {
  if (current > previous) return "positive" as const
  if (current < previous) return "danger" as const
  return fallback
}

function buildMetrics(data: DashboardData, isToday: boolean): DashboardMetric[] {
  const { metrics, previousMetrics } = data
  const salesLabel = isToday ? "Today’s Sales" : "Sales"
  const ordersLabel = isToday ? "Today’s Orders" : "Orders"
  const expensesLabel = isToday ? "Today’s Expenses" : "Expenses"
  const profitLabel = isToday ? "Today’s Profit" : "Profit"
  return [
    { title: salesLabel, value: money(data.currencyCode, metrics.salesTotal, data.locale), helper: relativeChange(metrics.salesTotal, previousMetrics.salesTotal), icon: CircleDollarSign, tone: metricTone(metrics.salesTotal, previousMetrics.salesTotal) },
    { title: ordersLabel, value: integer(metrics.ordersCount, data.locale), helper: relativeChange(metrics.ordersCount, previousMetrics.ordersCount), icon: ClipboardList, tone: metricTone(metrics.ordersCount, previousMetrics.ordersCount) },
    { title: expensesLabel, value: money(data.currencyCode, metrics.expensesTotal, data.locale), helper: "Recorded expenses in selected period", icon: ReceiptText, tone: "neutral" },
    { title: profitLabel, value: money(data.currencyCode, metrics.profitTotal, data.locale), helper: metrics.salesTotal ? `${((metrics.profitTotal / metrics.salesTotal) * 100).toFixed(1)}% estimated margin` : "Estimated after costs and expenses", icon: TrendingUp, tone: metrics.profitTotal < 0 ? "danger" : "positive" },
    { title: "Customers", value: integer(metrics.customersCount, data.locale), helper: "Customers recorded to date", icon: Users, tone: "neutral" },
    { title: "Active Products", value: integer(metrics.productsCount, data.locale), helper: "Active catalogue listings", icon: Package, tone: "neutral" },
    { title: "Low Stock", value: integer(metrics.lowStockCount, data.locale), helper: metrics.lowStockCount ? "Needs your attention" : "All tracked stock is healthy", icon: Boxes, tone: metrics.lowStockCount ? "warning" : "neutral" },
    { title: "Out of Stock", value: integer(metrics.outOfStockCount, data.locale), helper: metrics.outOfStockCount ? "Restock when ready" : "No tracked items are out", icon: PackageX, tone: metrics.outOfStockCount ? "danger" : "neutral" },
  ]
}

function chartLabel(date: string, pointCount: number, locale: string) {
  const options: Intl.DateTimeFormatOptions = pointCount <= 7 ? { weekday: "short" } : { day: "numeric", month: "short" }
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`))
}

function SalesOverview({ currencyCode, locale, periodLabel, sales }: { currencyCode: string; locale: string; periodLabel: string; sales: DashboardData["salesOverview"] }) {
  const total = sales.reduce((sum, point) => sum + point.value, 0)
  const max = Math.max(...sales.map((point) => point.value), 1)
  const labels = [max, max * 0.75, max * 0.5, max * 0.25, 0]
  return <Card className="border-0 shadow-sm ring-1 ring-foreground/8 xl:col-span-2">
    <CardHeader className="border-b"><CardTitle as="h2">Sales Overview</CardTitle><CardDescription>Completed sales across {periodLabel.toLowerCase()}</CardDescription><CardAction><Badge className="gap-1.5" variant="outline"><CalendarDays aria-hidden="true" />{periodLabel}</Badge></CardAction></CardHeader>
    <CardContent>{sales.length ? <><div className="mb-6"><p className="text-xs font-medium text-muted-foreground">Total sales</p><p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{money(currencyCode, total, locale)}</p></div><div aria-label="Bar chart of completed sales" className="grid h-64 grid-cols-[3.25rem_1fr] gap-3" role="img"><div className="flex flex-col justify-between pb-7 text-right text-[10px] tabular-nums text-muted-foreground">{labels.map((value) => <span key={value}>{money(currencyCode, value, locale, true)}</span>)}</div><div className="relative grid gap-2" style={{ gridTemplateColumns: `repeat(${sales.length}, minmax(0, 1fr))` }}><div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-border" /><div className="pointer-events-none absolute inset-x-0 top-1/4 h-px bg-border/70" /><div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-border/70" /><div className="pointer-events-none absolute inset-x-0 top-3/4 h-px bg-border/70" /><div className="pointer-events-none absolute inset-x-0 bottom-7 h-px bg-border" />{sales.map((point) => <div className="relative z-10 flex min-w-0 flex-col justify-end gap-2" key={point.label}><div className="group flex min-h-0 flex-1 items-end justify-center"><div className="relative w-full max-w-10 rounded-t-md bg-primary/45 transition-colors hover:bg-primary" style={{ height: `${Math.max((point.value / max) * 100, point.value ? 2 : 0)}%` }} title={`${chartLabel(point.label, sales.length, locale)}: ${money(currencyCode, point.value, locale)}`}><span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[9px] font-medium text-background group-hover:block">{money(currencyCode, point.value, locale, true)}</span></div></div><span className="h-5 text-center text-[10px] font-medium text-muted-foreground sm:text-xs">{chartLabel(point.label, sales.length, locale)}</span></div>)}</div></div></> : <EmptyState message="No completed sales were recorded for this period." />}</CardContent>
  </Card>
}

function EmptyState({ message }: { message: string }) {
  return <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed px-5 text-center text-sm text-muted-foreground">{message}</div>
}

const productColours = ["bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300", "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300", "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300"]

function initials(value: string) {
  return value.split(/\s+/).map((word) => word[0] ?? "").join("").slice(0, 2).toUpperCase() || "P"
}

function TopProducts({ currencyCode, locale, periodLabel, products }: { currencyCode: string; locale: string; periodLabel: string; products: DashboardData["topProducts"] }) {
  const highestRevenue = Math.max(...products.map((product) => product.revenue), 1)
  return <Card className="border-0 shadow-sm ring-1 ring-foreground/8"><CardHeader className="border-b"><CardTitle as="h2">Top Products</CardTitle><CardDescription>Best performers by revenue for {periodLabel.toLowerCase()}</CardDescription></CardHeader><CardContent className="space-y-5">{products.length ? products.map((product, index) => <div key={product.id}><div className="flex items-center gap-3"><span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl text-xs font-semibold", productColours[index % productColours.length])}>{initials(product.name)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{product.name}</span><span className="block text-xs text-muted-foreground">{integer(product.units, locale)} sold · {product.category ?? "Uncategorised"}</span></span><span className="text-sm font-semibold tabular-nums">{money(currencyCode, product.revenue, locale)}</span></div><div className="ml-[3.25rem] mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/75" style={{ width: `${(product.revenue / highestRevenue) * 100}%` }} /></div></div>) : <EmptyState message="No products were sold in this period." />}<Link className="flex h-9 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/app/catalogue">View catalogue<ArrowRight aria-hidden="true" className="size-3.5" /></Link></CardContent></Card>
}

const transactionStatus: Record<DashboardData["transactions"][number]["status"], { className?: string; label: string; variant: "destructive" | "outline" | "secondary" }> = {
  completed: { className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", label: "Completed", variant: "secondary" },
  pending: { className: "bg-amber-500/10 text-amber-700 dark:text-amber-400", label: "Pending", variant: "secondary" },
  refunded: { label: "Refunded", variant: "destructive" },
}

function time(value: string, timeZone: string, locale: string, timeFormat: DashboardData["timeFormat"]) {
  return new Intl.DateTimeFormat(locale, { hour: "numeric", hour12: timeFormat === "12h", minute: "2-digit", timeZone }).format(new Date(value))
}

function RecentTransactions({ currencyCode, locale, timeFormat, timeZone, transactions }: { currencyCode: string; locale: string; timeFormat: DashboardData["timeFormat"]; timeZone: string; transactions: DashboardData["transactions"] }) {
  return <Card className="border-0 shadow-sm ring-1 ring-foreground/8 xl:col-span-2"><CardHeader className="border-b"><CardTitle as="h2">Recent Transactions</CardTitle><CardDescription>Latest completed, pending, and refunded sales in the selected period</CardDescription><CardAction><ButtonLink href="/app/sales" size="sm" variant="ghost">View all<ArrowRight aria-hidden="true" data-icon="inline-end" /></ButtonLink></CardAction></CardHeader><CardContent className="px-0">{transactions.length ? <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="pl-4 sm:pl-6">Transaction</TableHead><TableHead>Customer</TableHead><TableHead>Channel</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="pr-4 text-right sm:pr-6">Time</TableHead></TableRow></TableHeader><TableBody>{transactions.map((transaction) => { const status = transactionStatus[transaction.status]; return <TableRow key={transaction.id}><TableCell className="pl-4 font-medium sm:pl-6">{transaction.id}</TableCell><TableCell>{transaction.customer}</TableCell><TableCell className="capitalize text-muted-foreground">{transaction.channel}</TableCell><TableCell><Badge className={status.className} variant={status.variant}>{status.label}</Badge></TableCell><TableCell className="text-right font-medium tabular-nums">{money(currencyCode, transaction.amount, locale)}</TableCell><TableCell className="pr-4 text-right text-muted-foreground sm:pr-6">{time(transaction.soldAt, timeZone, locale, timeFormat)}</TableCell></TableRow> })}</TableBody></Table> : <div className="p-6"><EmptyState message="No transactions were recorded for this period." /></div>}</CardContent></Card>
}

const alertDetails = {
  "low-stock": { description: "Review stock levels before your next sales window.", icon: Boxes, label: "Review inventory", title: (count: number) => `${count} product${count === 1 ? " is" : "s are"} running low`, tone: "warning" },
  "out-of-stock": { description: "These products may need restocking or catalogue updates.", icon: PackageX, label: "View products", title: (count: number) => `${count} product${count === 1 ? " is" : "s are"} out of stock`, tone: "danger" },
  "pending-orders": { description: "Recent orders are waiting in the orders workspace.", icon: ShoppingBag, label: "Open orders", title: (count: number) => `${count} order${count === 1 ? " needs" : "s need"} review`, tone: "info" },
} as const

const alertToneStyles = { warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400", danger: "bg-destructive/10 text-destructive", info: "bg-sky-500/10 text-sky-700 dark:text-sky-400" } as const

function BusinessAlerts({ alerts }: { alerts: DashboardData["alerts"] }) {
  return <Card className="border-0 shadow-sm ring-1 ring-foreground/8"><CardHeader className="border-b"><CardTitle as="h2">Business Alerts</CardTitle><CardDescription>Items that may need attention</CardDescription><CardAction><Badge variant="secondary">{alerts.length} alert{alerts.length === 1 ? "" : "s"}</Badge></CardAction></CardHeader><CardContent className="space-y-3">{alerts.length ? alerts.map((alert) => { const detail = alertDetails[alert.kind]; const Icon = detail.icon; return <div className="rounded-xl border bg-background p-3.5" key={alert.kind}><div className="flex items-start gap-3"><span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", alertToneStyles[detail.tone])}><Icon aria-hidden="true" className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{detail.title(alert.count)}</span><span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{detail.description}</span><Link className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={alert.href}>{detail.label}<ArrowRight aria-hidden="true" className="size-3" /></Link></span></div></div> }) : <EmptyState message="No stock or order alerts right now." />}</CardContent></Card>
}

type DashboardOverviewProps = {
  businessName: string
  dashboard: DashboardData
  dateRangeLabel: string
  endDate: string
  startDate: string
  todayDate: string
}

export function DashboardOverview({ businessName, dashboard, dateRangeLabel, endDate, startDate, todayDate }: DashboardOverviewProps) {
  const isToday = startDate === todayDate && endDate === todayDate
  const periodLabel = isToday ? "Today" : dateRangeLabel
  const metrics = buildMetrics(dashboard, isToday)
  return <div className="space-y-6"><header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><div className="mb-2 flex items-center gap-2"><Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" variant="secondary">Live overview</Badge></div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Good morning</h1><p className="mt-1.5 text-sm text-muted-foreground">{isToday ? `Here’s how ${businessName} is performing today.` : `Here’s how ${businessName} performed for ${dateRangeLabel}.`}</p></div><div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end xl:w-auto"><DashboardDateFilter endDate={endDate} startDate={startDate} todayDate={todayDate} /><DashboardExportButton endDate={endDate} startDate={startDate} /></div></header><section aria-labelledby="business-metrics-heading"><h2 className="sr-only" id="business-metrics-heading">Business metrics</h2><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{metrics.map((metric) => <MetricCard key={metric.title} metric={metric} />)}</div></section><section aria-label="Sales and product performance" className="grid gap-6 xl:grid-cols-3"><SalesOverview currencyCode={dashboard.currencyCode} locale={dashboard.locale} periodLabel={periodLabel} sales={dashboard.salesOverview} /><TopProducts currencyCode={dashboard.currencyCode} locale={dashboard.locale} periodLabel={periodLabel} products={dashboard.topProducts} /></section><section aria-label="Recent transactions and business alerts" className="grid gap-6 xl:grid-cols-3"><RecentTransactions currencyCode={dashboard.currencyCode} locale={dashboard.locale} timeFormat={dashboard.timeFormat} timeZone={dashboard.timeZone} transactions={dashboard.transactions} /><BusinessAlerts alerts={dashboard.alerts} /></section></div>
}
