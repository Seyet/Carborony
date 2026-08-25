import Form from "next/form"
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Package,
  ReceiptText,
  TrendingUp,
  WalletCards,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { EmptyState } from "@/components/common"
import { Badge } from "@/components/ui/badge"
import { Button, ButtonLink, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type {
  ExpenseReportData,
  InventoryReportData,
  InventoryReportView,
  ProfitReportData,
  ReportFilters,
  ReportKind,
  ReportsPageData,
  SalesReportData,
} from "./types"

const reportTabs: Array<{
  description: string
  icon: LucideIcon
  label: string
  report: ReportKind
}> = [
  {
    description: "Revenue and sales performance",
    icon: BarChart3,
    label: "Sales",
    report: "sales",
  },
  {
    description: "Stock, movement, and valuation",
    icon: Boxes,
    label: "Inventory",
    report: "inventory",
  },
  {
    description: "Spending by category and date",
    icon: ReceiptText,
    label: "Expenses",
    report: "expenses",
  },
  {
    description: "Gross and net profitability",
    icon: TrendingUp,
    label: "Profit",
    report: "profit",
  },
]

const paymentMethodLabels: Record<string, string> = {
  bank_transfer: "Bank transfer",
  card: "Card",
  cash: "Cash",
  other: "Other",
  pos: "POS",
}

const inventoryViewLabels: Record<InventoryReportView, string> = {
  "current-stock": "Current stock",
  "stock-movement": "Stock movement",
  "stock-valuation": "Stock valuation",
}

function formatCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en-NG", {
    currency: currencyCode,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: 3,
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`))
}

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: timezone,
    year: "numeric",
  }).format(new Date(value))
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(" ")
}

function dateRangeLabel(filters: ReportFilters) {
  return filters.startDate === filters.endDate
    ? formatDate(filters.startDate)
    : `${formatDate(filters.startDate)} – ${formatDate(filters.endDate)}`
}

function reportsHref(
  filters: ReportFilters,
  overrides: Partial<ReportFilters> = {},
) {
  const next = { ...filters, ...overrides }
  const params = new URLSearchParams()
  params.set("report", next.report)
  params.set("startDate", next.startDate)
  params.set("endDate", next.endDate)
  if (next.view) params.set("view", next.view)
  if (next.productId) params.set("productId", next.productId)
  if (next.categoryId) params.set("categoryId", next.categoryId)
  if (next.staffId) params.set("staffId", next.staffId)
  if (next.paymentMethod) params.set("paymentMethod", next.paymentMethod)
  if (next.page > 1) params.set("page", String(next.page))

  return `/app/reports?${params.toString()}`
}

function reportTabHref(filters: ReportFilters, report: ReportKind) {
  const view = report === "inventory"
    ? "current-stock"
    : report === "expenses"
      ? "category"
      : ""

  return reportsHref(filters, { page: 1, report, view })
}

function resetFiltersHref(filters: ReportFilters) {
  const params = new URLSearchParams({ report: filters.report })
  if (filters.view) params.set("view", filters.view)
  return `/app/reports?${params.toString()}`
}

function exportHref(filters: ReportFilters, format: "csv" | "excel" | "pdf") {
  const params = new URLSearchParams({
    endDate: filters.endDate,
    format,
    report: filters.report,
    startDate: filters.startDate,
  })

  if (filters.report === "sales") {
    if (filters.productId) params.set("productId", filters.productId)
    if (filters.categoryId) params.set("categoryId", filters.categoryId)
    if (filters.staffId) params.set("staffId", filters.staffId)
    if (filters.paymentMethod) params.set("paymentMethod", filters.paymentMethod)
  }
  if (filters.report === "inventory" && filters.view) {
    params.set("view", filters.view)
  }
  if (filters.report === "expenses" && filters.view) {
    params.set("view", filters.view)
  }

  return `/api/reports/export?${params.toString()}`
}

function MetricCard({
  helper,
  icon: Icon,
  label,
  tone = "neutral",
  value,
}: {
  helper?: string
  icon: LucideIcon
  label: string
  tone?: "neutral" | "positive" | "warning" | "danger"
  value: string
}) {
  const tones = {
    danger: "bg-destructive/10 text-destructive",
    neutral: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    positive: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  }

  return (
    <Card className="border-0 py-0 shadow-sm ring-1 ring-foreground/8">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              {label}
            </p>
            <p className="mt-1.5 truncate text-base font-semibold tracking-tight tabular-nums sm:text-xl">
              {value}
            </p>
          </div>
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
            <Icon aria-hidden="true" className="size-4" />
          </span>
        </div>
        {helper ? (
          <p className="mt-2 truncate text-[11px] text-muted-foreground">{helper}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ExportLinks({ filters }: { filters: ReportFilters }) {
  const links = [
    { format: "pdf" as const, icon: FileText, label: "PDF" },
    { format: "csv" as const, icon: Download, label: "CSV" },
    { format: "excel" as const, icon: FileSpreadsheet, label: "Excel" },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Report downloads">
      {links.map(({ format, icon: Icon, label }) => (
        <a
          className={buttonVariants({ size: "sm", variant: "outline" })}
          download
          href={exportHref(filters, format)}
          key={format}
        >
          <Icon aria-hidden="true" />
          {label}
        </a>
      ))}
    </div>
  )
}

function HiddenReportState({ filters }: { filters: ReportFilters }) {
  return (
    <>
      <input name="report" type="hidden" value={filters.report} />
      {filters.view ? <input name="view" type="hidden" value={filters.view} /> : null}
      {filters.report !== "sales" && filters.productId ? (
        <input name="productId" type="hidden" value={filters.productId} />
      ) : null}
      {filters.report !== "sales" && filters.categoryId ? (
        <input name="categoryId" type="hidden" value={filters.categoryId} />
      ) : null}
      {filters.report !== "sales" && filters.staffId ? (
        <input name="staffId" type="hidden" value={filters.staffId} />
      ) : null}
      {filters.report !== "sales" && filters.paymentMethod ? (
        <input name="paymentMethod" type="hidden" value={filters.paymentMethod} />
      ) : null}
    </>
  )
}

function DateFields({ data }: { data: ReportsPageData }) {
  return (
    <>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="report-start-date">
          Start date
        </label>
        <div className="relative">
          <CalendarDays aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 bg-background pl-8 text-xs"
            defaultValue={data.filters.startDate}
            id="report-start-date"
            max={data.todayDate}
            min="1900-01-01"
            name="startDate"
            required
            type="date"
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="report-end-date">
          End date
        </label>
        <div className="relative">
          <CalendarDays aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 bg-background pl-8 text-xs"
            defaultValue={data.filters.endDate}
            id="report-end-date"
            max={data.todayDate}
            min="1900-01-01"
            name="endDate"
            required
            type="date"
          />
        </div>
      </div>
    </>
  )
}

function ReportFiltersForm({ data }: { data: ReportsPageData }) {
  const showDates = data.filters.report !== "inventory"
    || data.filters.view === "stock-movement"
  const showSalesFilters = data.filters.report === "sales"
  if (!showDates && !showSalesFilters) return null

  const hasSalesFilters = Boolean(
    data.filters.productId
    || data.filters.categoryId
    || data.filters.staffId
    || data.filters.paymentMethod,
  )
  const defaultDates = data.filters.startDate === `${data.todayDate.slice(0, 7)}-01`
    && data.filters.endDate === data.todayDate
  const hasFilters = hasSalesFilters || !defaultDates

  return (
    <Form action="/app/reports" className="rounded-xl border bg-card p-2.5">
      <HiddenReportState filters={data.filters} />
      <div className={cn(
        "grid items-end gap-3",
        showSalesFilters
          ? "sm:grid-cols-2 xl:grid-cols-3"
          : "sm:grid-cols-2 xl:max-w-2xl",
      )}>
        {showDates ? <DateFields data={data} /> : null}
        {showSalesFilters ? (
          <>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="report-product">
                Product
              </label>
              <select
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-xs"
                defaultValue={data.filters.productId}
                id="report-product"
                name="productId"
              >
                <option value="">All products</option>
                {data.options.products.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}{option.detail ? ` — ${option.detail}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="report-category">
                Category
              </label>
              <select
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-xs"
                defaultValue={data.filters.categoryId}
                id="report-category"
                name="categoryId"
              >
                <option value="">All categories</option>
                {data.options.categories.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}{option.detail ? ` — ${option.detail}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="report-staff">
                Staff
              </label>
              <select
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-xs"
                defaultValue={data.filters.staffId}
                id="report-staff"
                name="staffId"
              >
                <option value="">All staff</option>
                {data.options.staff.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}{option.detail ? ` — ${option.detail}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="report-payment">
                Payment method
              </label>
              <select
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-xs"
                defaultValue={data.filters.paymentMethod}
                id="report-payment"
                name="paymentMethod"
              >
                <option value="">All payment methods</option>
                {data.options.paymentMethods.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
          </>
        ) : null}
        <div className={cn(
          "flex items-center gap-2 sm:col-span-2 sm:justify-end",
          showSalesFilters && "xl:col-span-3",
        )}>
          <Button className="h-9 min-w-28" size="sm" type="submit">
            Apply filters
          </Button>
          {hasFilters ? (
            <ButtonLink className="h-9" href={resetFiltersHref(data.filters)} size="sm" variant="ghost">
              Reset
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </Form>
  )
}

function Pagination({
  filters,
  noun,
  page,
  pageCount,
  totalCount,
}: {
  filters: ReportFilters
  noun: string
  page: number
  pageCount: number
  totalCount: number
}) {
  if (!totalCount) return null
  const firstItem = (page - 1) * 25 + 1
  const lastItem = Math.min(page * 25, totalCount)

  return (
    <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p>Showing {firstItem}–{lastItem} of {totalCount} {noun}</p>
      <div className="flex flex-wrap items-center gap-2">
        {page > 1 ? (
          <ButtonLink href={reportsHref(filters, { page: page - 1 })} size="sm" variant="outline">
            <ChevronLeft aria-hidden="true" />
            Previous
          </ButtonLink>
        ) : (
          <Button disabled size="sm" variant="outline">
            <ChevronLeft aria-hidden="true" />
            Previous
          </Button>
        )}
        <span className="px-1 sm:px-2">Page {page} of {pageCount}</span>
        {page < pageCount ? (
          <ButtonLink href={reportsHref(filters, { page: page + 1 })} size="sm" variant="outline">
            Next
            <ChevronRight aria-hidden="true" />
          </ButtonLink>
        ) : (
          <Button disabled size="sm" variant="outline">
            Next
            <ChevronRight aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )
}

function SalesReport({ data, filters }: { data: SalesReportData; filters: ReportFilters }) {
  const summary = data.summary

  return (
    <div className="space-y-6">
      <section aria-label="Sales report summary" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard icon={CircleDollarSign} label="Revenue" tone="positive" value={formatCurrency(summary.revenue, summary.currencyCode)} />
        <MetricCard icon={WalletCards} label="COGS" value={formatCurrency(summary.cogs, summary.currencyCode)} />
        <MetricCard icon={TrendingUp} label="Gross profit" tone={summary.grossProfit >= 0 ? "positive" : "danger"} value={formatCurrency(summary.grossProfit, summary.currencyCode)} />
        <MetricCard icon={ReceiptText} label="Transactions" value={formatNumber(summary.transactionCount)} />
        <MetricCard icon={Package} label="Units sold" value={formatNumber(summary.unitsSold)} />
        <MetricCard icon={BarChart3} label="Average sale" value={formatCurrency(summary.averageSale, summary.currencyCode)} />
      </section>

      {data.rows.length ? (
        <>
          <Card className="border-0 shadow-sm ring-1 ring-foreground/8" size="sm">
            <CardHeader className="border-b">
              <CardTitle as="h2">Sales detail</CardTitle>
              <CardDescription className="text-xs">Completed sale line items for {dateRangeLabel(filters)}.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Table className="text-xs [&_td]:py-1.5 [&_th]:h-8 [&_th]:py-1.5">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 sm:pl-6">Date</TableHead>
                    <TableHead>Sale</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="hidden 2xl:table-cell">Category</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden 2xl:table-cell">Staff</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Qty.</TableHead>
                    <TableHead className="hidden text-right 2xl:table-cell">Unit price</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="hidden text-right 2xl:table-cell">COGS</TableHead>
                    <TableHead className="pr-4 text-right sm:pr-6">Gross profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <TableRow key={row.saleItemId}>
                      <TableCell className="pl-4 text-muted-foreground sm:pl-6">{formatDate(row.saleDate)}</TableCell>
                      <TableCell className="font-medium">{row.saleNumber}</TableCell>
                      <TableCell>
                        <span className="block font-medium">{row.productName}</span>
                        {row.variantName ? <span className="block text-xs text-muted-foreground">{row.variantName}</span> : null}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground 2xl:table-cell">{row.categoryName ?? "Uncategorised"}</TableCell>
                      <TableCell>{row.customerName}</TableCell>
                      <TableCell className="hidden 2xl:table-cell">{row.staffName}</TableCell>
                      <TableCell>{paymentMethodLabels[row.paymentMethod] ?? formatLabel(row.paymentMethod)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row.quantity)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums 2xl:table-cell">{formatCurrency(row.unitPrice, row.currencyCode)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(row.revenue, row.currencyCode)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums 2xl:table-cell">{formatCurrency(row.cogs, row.currencyCode)}</TableCell>
                      <TableCell className={cn("pr-4 text-right font-medium tabular-nums sm:pr-6", row.grossProfit < 0 && "text-destructive")}>
                        {formatCurrency(row.grossProfit, row.currencyCode)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Pagination filters={filters} noun="sale items" page={data.page} pageCount={data.pageCount} totalCount={data.totalCount} />
        </>
      ) : (
        <EmptyState
          description="No completed sales match this date range and filter combination."
          icon={BarChart3}
          title="No sales to report"
        />
      )}
    </div>
  )
}

function StockStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    in_stock: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    low_stock: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    out_of_stock: "bg-destructive/10 text-destructive",
    untracked: "bg-muted text-muted-foreground",
  }
  return (
    <Badge className={styles[status]} variant="secondary">
      {status === "untracked" ? "Not tracked" : formatLabel(status)}
    </Badge>
  )
}

function InventoryViewTabs({ filters }: { filters: ReportFilters }) {
  return (
    <div className="flex w-fit max-w-full overflow-x-auto rounded-lg bg-muted p-[3px]">
      {(Object.keys(inventoryViewLabels) as InventoryReportView[]).map((view) => (
        <ButtonLink
          aria-current={filters.view === view ? "page" : undefined}
          className="h-7 px-2 text-xs"
          href={reportsHref(filters, { page: 1, view })}
          key={view}
          size="sm"
          variant={filters.view === view ? "secondary" : "ghost"}
        >
          {inventoryViewLabels[view]}
        </ButtonLink>
      ))}
    </div>
  )
}

function InventoryReport({
  data,
  filters,
  timezone,
}: {
  data: InventoryReportData
  filters: ReportFilters
  timezone: string
}) {
  const summary = data.summary
  const hasRows = data.view === "stock-movement"
    ? data.movementRows.length > 0
    : data.stockRows.length > 0

  return (
    <div className="space-y-6">
      <InventoryViewTabs filters={filters} />
      <section aria-label="Inventory report summary" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard icon={Package} label="Products" value={formatNumber(summary.totalProducts)} />
        <MetricCard icon={Boxes} label="Units on hand" value={formatNumber(summary.totalUnits)} />
        <MetricCard icon={CircleDollarSign} label="Stock valuation" tone="positive" value={formatCurrency(summary.inventoryValue, summary.currencyCode)} />
        <MetricCard icon={AlertTriangle} label="Low stock" tone="warning" value={formatNumber(summary.lowStockCount)} />
        <MetricCard icon={Package} label="Out of stock" tone={summary.outOfStockCount ? "danger" : "neutral"} value={formatNumber(summary.outOfStockCount)} />
      </section>

      {hasRows ? (
        <>
          <Card className="border-0 shadow-sm ring-1 ring-foreground/8" size="sm">
            <CardHeader className="border-b">
              <CardTitle as="h2">{inventoryViewLabels[data.view]}</CardTitle>
              <CardDescription className="text-xs">
                {data.view === "stock-movement"
                  ? `Inventory movements for ${dateRangeLabel(filters)}.`
                  : data.view === "stock-valuation"
                    ? "Current inventory value at cost."
                    : "Current quantity and reorder position for every product."}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {data.view === "stock-movement" ? (
                <Table className="text-xs [&_td]:py-1.5 [&_th]:h-8 [&_th]:py-1.5">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4 sm:pl-6">Date</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Movement</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit cost</TableHead>
                      <TableHead className="pr-4 text-right sm:pr-6">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.movementRows.map((row) => (
                      <TableRow key={row.movementId}>
                        <TableCell className="pl-4 text-muted-foreground sm:pl-6">{formatDateTime(row.occurredAt, timezone)}</TableCell>
                        <TableCell>
                          <span className="block font-medium">{row.productName}</span>
                          <span className="block text-xs text-muted-foreground">
                            {[row.variantName, row.productSku].filter(Boolean).join(" · ") || "No SKU"}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{row.categoryName ?? "Uncategorised"}</TableCell>
                        <TableCell>{row.locationName}</TableCell>
                        <TableCell><Badge variant="outline">{formatLabel(row.movementType)}</Badge></TableCell>
                        <TableCell>{row.staffName}</TableCell>
                        <TableCell className={cn("text-right font-medium tabular-nums", row.quantityDelta > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
                          {row.quantityDelta > 0 ? "+" : ""}{formatNumber(row.quantityDelta)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.unitCost === null ? "—" : formatCurrency(row.unitCost, row.currencyCode)}
                        </TableCell>
                        <TableCell className="pr-4 text-right tabular-nums sm:pr-6">
                          {row.movementValue === null ? "—" : formatCurrency(row.movementValue, row.currencyCode)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : data.view === "stock-valuation" ? (
                <Table className="text-xs [&_td]:py-1.5 [&_th]:h-8 [&_th]:py-1.5">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4 sm:pl-6">Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit cost</TableHead>
                      <TableHead className="pr-4 text-right sm:pr-6">Stock value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.stockRows.map((row) => (
                      <TableRow key={row.productId}>
                        <TableCell className="pl-4 font-medium sm:pl-6">{row.name}</TableCell>
                        <TableCell className="text-muted-foreground">{row.sku ?? "—"}</TableCell>
                        <TableCell>{row.categoryName ?? "Uncategorised"}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.tracksInventory ? formatNumber(row.stockQuantity) : "Not tracked"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(row.unitCost, row.currencyCode)}</TableCell>
                        <TableCell className="pr-4 text-right font-medium tabular-nums sm:pr-6">{formatCurrency(row.stockValue, row.currencyCode)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Table className="text-xs [&_td]:py-1.5 [&_th]:h-8 [&_th]:py-1.5">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4 sm:pl-6">Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Current stock</TableHead>
                      <TableHead className="text-right">Reorder level</TableHead>
                      <TableHead className="pr-4 sm:pr-6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.stockRows.map((row) => (
                      <TableRow key={row.productId}>
                        <TableCell className="pl-4 font-medium sm:pl-6">{row.name}</TableCell>
                        <TableCell className="text-muted-foreground">{row.sku ?? "—"}</TableCell>
                        <TableCell>{row.categoryName ?? "Uncategorised"}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.tracksInventory ? formatNumber(row.stockQuantity) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.tracksInventory ? formatNumber(row.reorderLevel) : "—"}</TableCell>
                        <TableCell className="pr-4 sm:pr-6"><StockStatusBadge status={row.stockStatus} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Pagination filters={filters} noun={data.view === "stock-movement" ? "movements" : "products"} page={data.page} pageCount={data.pageCount} totalCount={data.totalCount} />
        </>
      ) : (
        <EmptyState
          description={data.view === "stock-movement" ? "No stock movements occurred in this date range." : "Products will appear here after they are added to the catalogue."}
          icon={Boxes}
          title={data.view === "stock-movement" ? "No stock movement to report" : "No inventory to report"}
        />
      )}
    </div>
  )
}

function ExpenseViewTabs({ filters }: { filters: ReportFilters }) {
  return (
    <div className="flex w-fit rounded-lg bg-muted p-[3px]">
      <ButtonLink
        aria-current={filters.view === "category" ? "page" : undefined}
        className="h-7 px-2 text-xs"
        href={reportsHref(filters, { page: 1, view: "category" })}
        size="sm"
        variant={filters.view === "category" ? "secondary" : "ghost"}
      >
        By category
      </ButtonLink>
      <ButtonLink
        aria-current={filters.view === "date" ? "page" : undefined}
        className="h-7 px-2 text-xs"
        href={reportsHref(filters, { page: 1, view: "date" })}
        size="sm"
        variant={filters.view === "date" ? "secondary" : "ghost"}
      >
        By date
      </ButtonLink>
    </div>
  )
}

function ExpenseReport({ data, filters, currencyCode }: { data: ExpenseReportData; filters: ReportFilters; currencyCode: string }) {
  const rows = data.view === "category" ? data.categoryRows : data.dateRows
  const totalAmount = rows.reduce((total, row) => total + row.totalAmount, 0)
  const totalCount = rows.reduce((total, row) => total + row.expenseCount, 0)
  const leadingCategory = data.categoryRows[0]

  return (
    <div className="space-y-6">
      <ExpenseViewTabs filters={filters} />
      <section aria-label="Expense report summary" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard icon={CircleDollarSign} label="Total expenses" tone="warning" value={formatCurrency(totalAmount, rows[0]?.currencyCode ?? currencyCode)} />
        <MetricCard icon={ReceiptText} label="Expense records" value={formatNumber(totalCount)} />
        <MetricCard
          helper={data.view === "category" ? "Highest spend category" : "Days with recorded expenses"}
          icon={data.view === "category" ? WalletCards : CalendarDays}
          label={data.view === "category" ? "Leading category" : "Active expense days"}
          value={data.view === "category" ? leadingCategory?.categoryName ?? "—" : formatNumber(data.dateRows.length)}
        />
      </section>

      {rows.length ? (
        <Card className="border-0 shadow-sm ring-1 ring-foreground/8" size="sm">
          <CardHeader className="border-b">
            <CardTitle as="h2">Expenses by {data.view}</CardTitle>
            <CardDescription className="text-xs">Recorded business expenses for {dateRangeLabel(filters)}.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {data.view === "category" ? (
              <Table className="text-xs [&_td]:py-1.5 [&_th]:h-8 [&_th]:py-1.5">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 sm:pl-6">Category</TableHead>
                    <TableHead className="text-right">Records</TableHead>
                    <TableHead>Share of expenses</TableHead>
                    <TableHead className="pr-4 text-right sm:pr-6">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.categoryRows.map((row) => (
                    <TableRow key={row.categoryId}>
                      <TableCell className="pl-4 font-medium sm:pl-6">{row.categoryName}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row.expenseCount)}</TableCell>
                      <TableCell>
                        <div className="flex min-w-36 items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, row.percentageOfTotal))}%` }} />
                          </div>
                          <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{row.percentageOfTotal.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="pr-4 text-right font-medium tabular-nums sm:pr-6">{formatCurrency(row.totalAmount, row.currencyCode)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table className="text-xs [&_td]:py-1.5 [&_th]:h-8 [&_th]:py-1.5">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 sm:pl-6">Date</TableHead>
                    <TableHead className="text-right">Expense records</TableHead>
                    <TableHead className="pr-4 text-right sm:pr-6">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.dateRows.map((row) => (
                    <TableRow key={row.expenseDate}>
                      <TableCell className="pl-4 font-medium sm:pl-6">{formatDate(row.expenseDate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row.expenseCount)}</TableCell>
                      <TableCell className="pr-4 text-right font-medium tabular-nums sm:pr-6">{formatCurrency(row.totalAmount, row.currencyCode)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          description="No recorded expenses fall within this date range."
          icon={ReceiptText}
          title="No expenses to report"
        />
      )}
    </div>
  )
}

function ProfitReport({ data, filters }: { data: ProfitReportData; filters: ReportFilters }) {
  const summary = data.summary

  return (
    <div className="space-y-6">
      <section aria-label="Profit report summary" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard icon={CircleDollarSign} label="Revenue" tone="positive" value={formatCurrency(summary.revenue, summary.currencyCode)} />
        <MetricCard icon={Package} label="COGS" value={formatCurrency(summary.cogs, summary.currencyCode)} />
        <MetricCard icon={ReceiptText} label="Expenses" tone="warning" value={formatCurrency(summary.expenses, summary.currencyCode)} />
        <MetricCard icon={BarChart3} label="Gross profit" tone={summary.grossProfit >= 0 ? "positive" : "danger"} value={formatCurrency(summary.grossProfit, summary.currencyCode)} />
        <MetricCard icon={TrendingUp} label="Net profit" tone={summary.netProfit >= 0 ? "positive" : "danger"} value={formatCurrency(summary.netProfit, summary.currencyCode)} />
      </section>

      {data.rows.length ? (
        <Card className="border-0 shadow-sm ring-1 ring-foreground/8" size="sm">
          <CardHeader className="border-b">
            <CardTitle as="h2">Daily profit breakdown</CardTitle>
            <CardDescription className="text-xs">Revenue less cost of goods sold and recorded expenses for {dateRangeLabel(filters)}.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table className="text-xs [&_td]:py-1.5 [&_th]:h-8 [&_th]:py-1.5">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4 sm:pl-6">Date</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Gross profit</TableHead>
                  <TableHead className="pr-4 text-right sm:pr-6">Net profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.reportDate}>
                    <TableCell className="pl-4 font-medium sm:pl-6">{formatDate(row.reportDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.revenue, row.currencyCode)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.cogs, row.currencyCode)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.expenses, row.currencyCode)}</TableCell>
                    <TableCell className={cn("text-right font-medium tabular-nums", row.grossProfit < 0 && "text-destructive")}>{formatCurrency(row.grossProfit, row.currencyCode)}</TableCell>
                    <TableCell className={cn("pr-4 text-right font-semibold tabular-nums sm:pr-6", row.netProfit < 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")}>{formatCurrency(row.netProfit, row.currencyCode)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          description="Sales and expenses in this date range will appear in the profitability report."
          icon={TrendingUp}
          title="No profit activity to report"
        />
      )}
    </div>
  )
}

export function ReportsWorkspace({ data }: { data: ReportsPageData }) {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" variant="secondary">
              Online view
            </Badge>
            <span className="text-xs text-muted-foreground">{data.businessName}</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Reports</h1>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
            Review business performance online, then download the current report as PDF, CSV, or Excel.
          </p>
        </div>
        <ExportLinks filters={data.filters} />
      </header>

      <nav aria-label="Report type" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {reportTabs.map(({ description, icon: Icon, label, report }) => {
          const active = data.filters.report === report
          return (
            <ButtonLink
              aria-current={active ? "page" : undefined}
              aria-label={`${label}: ${description}`}
              className={cn(
                "h-10 min-w-0 justify-center gap-2 px-3",
                active && "ring-1 ring-primary/25",
              )}
              href={reportTabHref(data.filters, report)}
              key={report}
              variant={active ? "secondary" : "outline"}
            >
              <Icon aria-hidden="true" className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
              <span className="text-sm font-medium">{label}</span>
            </ButtonLink>
          )
        })}
      </nav>

      <ReportFiltersForm data={data} />

      {data.reportData.kind === "sales" ? (
        <SalesReport data={data.reportData} filters={data.filters} />
      ) : data.reportData.kind === "inventory" ? (
        <InventoryReport data={data.reportData} filters={data.filters} timezone={data.timezone} />
      ) : data.reportData.kind === "expenses" ? (
        <ExpenseReport data={data.reportData} filters={data.filters} currencyCode={data.currencyCode} />
      ) : (
        <ProfitReport data={data.reportData} filters={data.filters} />
      )}
    </div>
  )
}
