import Link from "next/link"
import {
  ArrowRight,
  CalendarDays,
  TrendingUp,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
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
import { cn } from "@/lib/utils"

import {
  businessAlerts,
  dashboardMetrics,
  recentTransactions,
  topProducts,
  type TransactionStatus,
  weeklySales,
} from "./dashboard-data"
import { DashboardDateFilter } from "./dashboard-date-filter"
import { DashboardExportButton } from "./dashboard-export-button"
import { MetricCard } from "./metric-card"

function formatCompactNaira(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

function SalesOverview({ periodLabel }: { periodLabel: string }) {
  return (
    <Card className="border-0 shadow-sm ring-1 ring-foreground/8 xl:col-span-2">
      <CardHeader className="border-b">
        <CardTitle as="h2">Sales Overview</CardTitle>
        <CardDescription>
          Revenue across {periodLabel.toLowerCase()}
        </CardDescription>
        <CardAction>
          <Badge variant="outline" className="gap-1.5">
            <CalendarDays aria-hidden="true" />
            {periodLabel}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Total sales
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              ₦1,836,650
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <TrendingUp className="size-3.5" aria-hidden="true" />
            14.2% vs last week
          </div>
        </div>

        <div
          className="grid h-64 grid-cols-[2.75rem_1fr] gap-3"
          role="img"
          aria-label="Bar chart showing sales from Monday through Sunday, with Saturday highest at 356 thousand naira"
        >
          <div className="flex flex-col justify-between pb-7 text-right text-[10px] tabular-nums text-muted-foreground">
            <span>₦400k</span>
            <span>₦300k</span>
            <span>₦200k</span>
            <span>₦100k</span>
            <span>₦0</span>
          </div>
          <div className="relative grid grid-cols-7 gap-2 sm:gap-4">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-border" />
            <div className="pointer-events-none absolute inset-x-0 top-1/4 h-px bg-border/70" />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-border/70" />
            <div className="pointer-events-none absolute inset-x-0 top-3/4 h-px bg-border/70" />
            <div className="pointer-events-none absolute inset-x-0 bottom-7 h-px bg-border" />
            {weeklySales.map((point, index) => (
              <div
                key={point.day}
                className="relative z-10 flex min-w-0 flex-col justify-end gap-2 pb-0"
              >
                <div className="group flex min-h-0 flex-1 items-end justify-center">
                  <div
                    className={cn(
                      "relative w-full max-w-10 rounded-t-md bg-primary/14 transition-colors hover:bg-primary/25",
                      index === weeklySales.length - 1 &&
                        "bg-primary hover:bg-primary/85"
                    )}
                    style={{ height: `${point.height}%` }}
                    title={`${point.day}: ${formatCompactNaira(point.value)}`}
                  >
                    <span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[9px] font-medium text-background group-hover:block">
                      {formatCompactNaira(point.value)}
                    </span>
                  </div>
                </div>
                <span className="h-5 text-center text-[10px] font-medium text-muted-foreground sm:text-xs">
                  {point.day}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TopProducts({ periodLabel }: { periodLabel: string }) {
  return (
    <Card className="border-0 shadow-sm ring-1 ring-foreground/8">
      <CardHeader className="border-b">
        <CardTitle as="h2">Top Products</CardTitle>
        <CardDescription>
          Best performers by revenue for {periodLabel.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {topProducts.map((product) => (
          <div key={product.name}>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl text-xs font-semibold",
                  product.color
                )}
              >
                {product.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {product.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {product.units} sold · {product.category}
                </span>
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {product.revenue}
              </span>
            </div>
            <div className="ml-[3.25rem] mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/75"
                style={{ width: `${product.progress}%` }}
              />
            </div>
          </div>
        ))}
        <Link
          href="/app/catalogue"
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View catalogue
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  )
}

const transactionStatusVariants: Record<
  TransactionStatus,
  { variant: "secondary" | "outline" | "destructive"; className?: string }
> = {
  Completed: {
    variant: "secondary",
    className:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  Pending: {
    variant: "secondary",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  Refunded: { variant: "destructive" },
}

function RecentTransactions() {
  return (
    <Card className="border-0 shadow-sm ring-1 ring-foreground/8 xl:col-span-2">
      <CardHeader className="border-b">
        <CardTitle as="h2">Recent Transactions</CardTitle>
        <CardDescription>Latest activity across sales channels</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/app/sales" />}>
            View all
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 sm:pl-6">Transaction</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="pr-4 text-right sm:pr-6">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentTransactions.map((transaction) => {
              const status = transactionStatusVariants[transaction.status]

              return (
                <TableRow key={transaction.id}>
                  <TableCell className="pl-4 font-medium sm:pl-6">
                    {transaction.id}
                  </TableCell>
                  <TableCell>{transaction.customer}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {transaction.channel}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={status.variant}
                      className={status.className}
                    >
                      {transaction.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {transaction.amount}
                  </TableCell>
                  <TableCell className="pr-4 text-right text-muted-foreground sm:pr-6">
                    {transaction.time}
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

const alertToneStyles = {
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
} as const

function BusinessAlerts() {
  return (
    <Card className="border-0 shadow-sm ring-1 ring-foreground/8">
      <CardHeader className="border-b">
        <CardTitle as="h2">Business Alerts</CardTitle>
        <CardDescription>Items that may need attention</CardDescription>
        <CardAction>
          <Badge variant="secondary">3 alerts</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {businessAlerts.map((alert) => {
          const Icon = alert.icon

          return (
            <div
              key={alert.title}
              className="rounded-xl border bg-background p-3.5"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    alertToneStyles[alert.tone]
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {alert.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                    {alert.description}
                  </span>
                  <Link
                    href={alert.href}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {alert.label}
                    <ArrowRight className="size-3" aria-hidden="true" />
                  </Link>
                </span>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

type DashboardOverviewProps = {
  businessName: string
  dateRangeLabel: string
  endDate: string
  startDate: string
  todayDate: string
}

export function DashboardOverview({
  businessName,
  dateRangeLabel,
  endDate,
  startDate,
  todayDate,
}: DashboardOverviewProps) {
  const isToday = startDate === todayDate && endDate === todayDate
  const periodLabel = isToday ? "Today" : dateRangeLabel
  const metrics = isToday
    ? dashboardMetrics
    : dashboardMetrics.map((metric) => ({
        ...metric,
        helper: metric.helper.replace("from yesterday", "from previous day"),
        title: metric.title.replace(/^Today’s /, ""),
      }))

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge
              variant="secondary"
              className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            >
              Live overview
            </Badge>
            
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Good morning
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isToday
              ? `Here’s how ${businessName} is performing today.`
              : `Here’s how ${businessName} performed for ${dateRangeLabel}.`}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end xl:w-auto">
          <DashboardDateFilter
            endDate={endDate}
            startDate={startDate}
            todayDate={todayDate}
          />
          <DashboardExportButton endDate={endDate} startDate={startDate} />
        </div>
      </header>

      <section aria-labelledby="business-metrics-heading">
        <h2 id="business-metrics-heading" className="sr-only">
          Business metrics
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.title} metric={metric} />
          ))}
        </div>
      </section>

      <section
        aria-label="Sales and product performance"
        className="grid gap-6 xl:grid-cols-3"
      >
        <SalesOverview periodLabel={periodLabel} />
        <TopProducts periodLabel={periodLabel} />
      </section>

      <section
        aria-label="Recent transactions and business alerts"
        className="grid gap-6 xl:grid-cols-3"
      >
        <RecentTransactions />
        <BusinessAlerts />
      </section>
    </div>
  )
}
