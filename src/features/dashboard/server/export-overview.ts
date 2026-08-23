import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import type { DashboardExportData } from "@/features/dashboard/api-types"
import type { DashboardExportInput } from "@/features/dashboard/schemas"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

type CsvCell = number | string | null | undefined

function formatCsvCell(value: CsvCell) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : '""'
  }

  let normalized = value ?? ""

  // Prevent spreadsheet programs from evaluating tenant-provided text as a
  // formula when the CSV is opened.
  if (/^[=+\-@]/.test(normalized)) normalized = `'${normalized}`

  return `"${normalized.replaceAll('"', '""')}"`
}

function createCsv(rows: readonly CsvCell[][]) {
  return `\uFEFF${rows
    .map((row) => row.map((cell) => formatCsvCell(cell)).join(","))
    .join("\r\n")}`
}

function getTodayDate(timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric",
    }).format(new Date())
  } catch {
    throw new ApiError(
      500,
      "INVALID_BUSINESS_TIMEZONE",
      "The business timezone is not configured correctly.",
    )
  }
}

function throwQueryError(
  operation: string,
  error: { code?: string; message?: string },
): never {
  console.error(`Dashboard export ${operation} failed`, {
    code: error.code ?? "unknown",
  })

  throw new ApiError(
    500,
    "DASHBOARD_EXPORT_FAILED",
    "We couldn't prepare the dashboard export. Please try again.",
  )
}

export async function exportDashboardOverview(
  input: DashboardExportInput,
): Promise<JsonHandlerResult<DashboardExportData>> {
  const user = await getCurrentUser()

  if (!user) {
    throw new ApiError(
      401,
      "AUTH_REQUIRED",
      "Sign in again before exporting the dashboard.",
    )
  }

  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const settingsResult = await supabase
    .from("businesses")
    .select("currency_code, timezone")
    .eq("id", business.id)
    .single()

  if (settingsResult.error) {
    throwQueryError("business settings query", settingsResult.error)
  }

  const settings = settingsResult.data

  if (!settings) {
    throw new ApiError(
      500,
      "DASHBOARD_EXPORT_FAILED",
      "We couldn't prepare the dashboard export. Please try again.",
    )
  }

  if (input.endDate > getTodayDate(settings.timezone)) {
    throw new ApiError(
      422,
      "FUTURE_DATE_NOT_ALLOWED",
      "Dashboard exports cannot include future dates.",
    )
  }

  const argumentsForRange = {
    range_end: input.endDate,
    range_start: input.startDate,
    target_business_id: business.id,
  }
  const [metricsResult, overviewResult, productsResult, transactionsResult] =
    await Promise.all([
      supabase
        .rpc("get_dashboard_metrics", argumentsForRange)
        .single(),
      supabase.rpc("get_dashboard_sales_overview", argumentsForRange),
      supabase.rpc("get_dashboard_top_products", {
        ...argumentsForRange,
        result_limit: 10,
      }),
      supabase.rpc("get_dashboard_recent_transactions", {
        ...argumentsForRange,
        result_limit: 100,
      }),
    ])

  if (metricsResult.error) {
    throwQueryError("metrics query", metricsResult.error)
  }
  if (overviewResult.error) {
    throwQueryError("sales overview query", overviewResult.error)
  }
  if (productsResult.error) {
    throwQueryError("top products query", productsResult.error)
  }
  if (transactionsResult.error) {
    throwQueryError("recent transactions query", transactionsResult.error)
  }

  const metrics = metricsResult.data

  if (!metrics) {
    throw new ApiError(
      500,
      "DASHBOARD_EXPORT_FAILED",
      "We couldn't prepare the dashboard export. Please try again.",
    )
  }

  const rows: CsvCell[][] = [
    ["Carborony dashboard overview"],
    ["Business", business.name],
    ["Currency", settings.currency_code],
    ["Timezone", settings.timezone],
    ["Start date", input.startDate],
    ["End date", input.endDate],
    ["Generated at", new Date().toISOString()],
    [],
    ["Metrics"],
    ["Metric", "Value"],
    ["Sales", metrics.sales_total],
    ["Orders", metrics.orders_count],
    ["Expenses", metrics.expenses_total],
    ["Profit", metrics.profit_total],
    ["Customers", metrics.customers_count],
    ["Products", metrics.products_count],
    ["Low stock", metrics.low_stock_count],
    ["Out of stock", metrics.out_of_stock_count],
    ["Pending orders", metrics.pending_orders_count],
    [],
    ["Sales overview"],
    ["Date", "Sales", "Transactions"],
    ...(overviewResult.data ?? []).map((entry) => [
      entry.period_date,
      entry.sales_total,
      entry.transaction_count,
    ]),
    [],
    ["Top products"],
    ["Product", "Category", "Units sold", "Revenue"],
    ...(productsResult.data ?? []).map((product) => [
      product.product_name,
      product.category_name,
      product.units_sold,
      product.revenue,
    ]),
    [],
    ["Recent transactions"],
    [
      "Sale number",
      "Customer",
      "Channel",
      "Status",
      "Amount",
      "Sold at",
    ],
    ...(transactionsResult.data ?? []).map((transaction) => [
      transaction.sale_number,
      transaction.customer_name,
      transaction.channel,
      transaction.status,
      transaction.total_amount,
      transaction.sold_at,
    ]),
  ]

  return {
    data: {
      content: createCsv(rows),
      fileName: `dashboard-overview-${input.startDate}-to-${input.endDate}.csv`,
      mimeType: "text/csv;charset=utf-8",
    },
    message: "Dashboard overview exported successfully.",
  }
}
