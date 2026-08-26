import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { createClient } from "@/lib/supabase/server"
import type {
  DashboardAlert,
  DashboardSalesPoint,
  DashboardTopProduct,
  DashboardTransaction,
} from "../dashboard-data"

type DashboardMetrics = {
  customersCount: number
  expensesTotal: number
  lowStockCount: number
  ordersCount: number
  outOfStockCount: number
  pendingOrdersCount: number
  productsCount: number
  profitTotal: number
  salesTotal: number
}

export type DashboardData = {
  alerts: DashboardAlert[]
  currencyCode: string
  metrics: DashboardMetrics
  previousMetrics: DashboardMetrics
  salesOverview: DashboardSalesPoint[]
  timeZone: string
  topProducts: DashboardTopProduct[]
  transactions: DashboardTransaction[]
}

function previousRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  const duration = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  const previousEnd = new Date(start)
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1)
  const previousStart = new Date(previousEnd)
  previousStart.setUTCDate(previousStart.getUTCDate() - duration + 1)
  return { end: previousEnd.toISOString().slice(0, 10), start: previousStart.toISOString().slice(0, 10) }
}

function asNumber(value: number | string | null | undefined) {
  return Number(value ?? 0)
}

function mapMetrics(value: {
  customers_count: number
  expenses_total: number
  low_stock_count: number
  orders_count: number
  out_of_stock_count: number
  pending_orders_count: number
  products_count: number
  profit_total: number
  sales_total: number
} | null): DashboardMetrics {
  return {
    customersCount: asNumber(value?.customers_count),
    expensesTotal: asNumber(value?.expenses_total),
    lowStockCount: asNumber(value?.low_stock_count),
    ordersCount: asNumber(value?.orders_count),
    outOfStockCount: asNumber(value?.out_of_stock_count),
    pendingOrdersCount: asNumber(value?.pending_orders_count),
    productsCount: asNumber(value?.products_count),
    profitTotal: asNumber(value?.profit_total),
    salesTotal: asNumber(value?.sales_total),
  }
}

export async function getDashboardData(startDate: string, endDate: string): Promise<DashboardData> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const currentRange = { range_end: endDate, range_start: startDate, target_business_id: business.id }
  const previous = previousRange(startDate, endDate)
  const previousRangeArgs = { range_end: previous.end, range_start: previous.start, target_business_id: business.id }
  const [settingsResult, metricsResult, previousMetricsResult, overviewResult, productsResult, transactionsResult] = await Promise.all([
    supabase.from("businesses").select("currency_code, timezone").eq("id", business.id).single(),
    supabase.rpc("get_dashboard_metrics", currentRange).single(),
    supabase.rpc("get_dashboard_metrics", previousRangeArgs).single(),
    supabase.rpc("get_dashboard_sales_overview", currentRange),
    supabase.rpc("get_dashboard_top_products", { ...currentRange, result_limit: 5 }),
    supabase.rpc("get_dashboard_recent_transactions", { ...currentRange, result_limit: 10 }),
  ])
  const firstError = [settingsResult, metricsResult, previousMetricsResult, overviewResult, productsResult, transactionsResult]
    .find((result) => result.error)?.error
  if (firstError) throw new Error("Unable to load the dashboard.", { cause: firstError })

  const metrics = mapMetrics(metricsResult.data)
  return {
    alerts: [
      ...(metrics.lowStockCount ? [{ count: metrics.lowStockCount, href: "/app/inventory", kind: "low-stock" as const }] : []),
      ...(metrics.outOfStockCount ? [{ count: metrics.outOfStockCount, href: "/app/catalogue", kind: "out-of-stock" as const }] : []),
      ...(metrics.pendingOrdersCount ? [{ count: metrics.pendingOrdersCount, href: "/app/orders", kind: "pending-orders" as const }] : []),
    ],
    currencyCode: settingsResult.data?.currency_code ?? "NGN",
    metrics,
    previousMetrics: mapMetrics(previousMetricsResult.data),
    salesOverview: (overviewResult.data ?? []).map((entry) => ({ label: entry.period_date, value: asNumber(entry.sales_total) })),
    timeZone: settingsResult.data?.timezone ?? "Africa/Lagos",
    topProducts: (productsResult.data ?? []).map((product) => ({
      category: product.category_name,
      id: product.product_id,
      name: product.product_name,
      revenue: asNumber(product.revenue),
      units: asNumber(product.units_sold),
    })),
    transactions: (transactionsResult.data ?? []).map((transaction) => ({
      amount: asNumber(transaction.total_amount),
      channel: transaction.channel,
      customer: transaction.customer_name,
      id: transaction.sale_number,
      soldAt: transaction.sold_at,
      status: transaction.status === "completed" ? "completed" : transaction.status === "refunded" ? "refunded" : "pending",
    })),
  }
}
