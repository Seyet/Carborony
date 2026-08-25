import "server-only"

import { getCurrentBusinessOrNull } from "@/features/businesses/server/get-current-business"
import type { ReportExportQuery } from "@/features/reports/export/schema"
import type {
  ReportExportDocument,
  ReportExportField,
  ReportExportSection,
} from "@/features/reports/export/types"
import { ApiError } from "@/lib/api/server"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

const detailExportLimit = 5_000
const minimumReportDate = "1900-01-01"
const maximumRangeDays = 3_660

type ReportOption = {
  option_detail: string | null
  option_group: string
  option_id: string
  option_label: string
  option_order: number
}

type SalesSummary = {
  average_sale: number
  cogs: number
  currency_code: string
  gross_profit: number
  revenue: number
  transaction_count: number
  units_sold: number
}

type SalesRow = {
  category_id: string | null
  category_name: string | null
  cogs: number
  currency_code: string
  customer_name: string | null
  discount_amount: number
  gross_profit: number
  payment_method: string
  product_id: string | null
  product_name: string
  quantity: number
  revenue: number
  sale_date: string
  sale_id: string
  sale_item_id: string
  sale_number: string
  staff_id: string
  staff_name: string
  total_count: number
  unit_price: number
  variant_name: string | null
}

type InventorySummary = {
  currency_code: string
  inventory_value: number
  low_stock_count: number
  out_of_stock_count: number
  total_products: number
  total_units: number
}

type InventoryStockRow = {
  category_id: string | null
  category_name: string | null
  currency_code: string
  product_id: string
  product_name: string
  product_sku: string | null
  reorder_level: number
  stock_quantity: number
  stock_status: string
  stock_value: number
  total_count: number
  tracks_inventory: boolean
  unit_cost: number
}

type InventoryMovementRow = {
  category_id: string | null
  category_name: string | null
  currency_code: string
  location_name: string
  movement_date: string
  movement_id: string
  movement_type: string
  movement_value: number | null
  note: string | null
  occurred_at: string
  product_id: string
  product_name: string
  product_sku: string | null
  quantity_delta: number
  staff_name: string
  total_count: number
  unit_cost: number | null
  variant_name: string | null
}

type ExpenseCategoryRow = {
  category_id: string
  category_name: string
  currency_code: string
  expense_count: number
  percentage_of_total: number
  total_amount: number
}

type ExpenseDateRow = {
  currency_code: string
  expense_count: number
  expense_date: string
  total_amount: number
}

type ProfitSummary = {
  cogs: number
  currency_code: string
  expenses: number
  gross_profit: number
  net_profit: number
  revenue: number
}

type ProfitDateRow = ProfitSummary & { report_date: string }

function numberValue(value: number | null | undefined) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

function dateInTimeZone(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en", {
      day: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric",
    }).formatToParts(new Date())
    const values = new Map(parts.map((part) => [part.type, part.value]))
    const year = values.get("year")
    const month = values.get("month")
    const day = values.get("day")

    if (!year || !month || !day) throw new Error("Missing date part.")
    return `${year}-${month}-${day}`
  } catch {
    throw new ApiError(
      500,
      "INVALID_BUSINESS_TIMEZONE",
      "The business timezone is not configured correctly.",
    )
  }
}

function validateRange(input: ReportExportQuery, timeZone: string) {
  if (input.startDate < minimumReportDate) {
    throw new ApiError(
      422,
      "INVALID_REPORT_RANGE",
      "Report dates must be on or after January 1, 1900.",
    )
  }

  if (input.endDate > dateInTimeZone(timeZone)) {
    throw new ApiError(
      422,
      "FUTURE_DATE_NOT_ALLOWED",
      "Reports cannot include future dates.",
    )
  }

  const start = Date.parse(`${input.startDate}T00:00:00Z`)
  const end = Date.parse(`${input.endDate}T00:00:00Z`)
  const rangeDays = Math.floor((end - start) / 86_400_000) + 1

  if (rangeDays > maximumRangeDays) {
    throw new ApiError(
      422,
      "REPORT_RANGE_TOO_LARGE",
      "Reports can cover at most 3,660 days at a time.",
    )
  }
}

function throwQueryError(
  operation: string,
  error: { code?: string; message?: string },
): never {
  console.error(`Report export ${operation} failed`, {
    code: error.code ?? "unknown",
  })

  if (["PGRST202", "PGRST204", "PGRST205"].includes(error.code ?? "")) {
    throw new ApiError(
      503,
      "REPORTS_SETUP_REQUIRED",
      "Reports are not available until the latest database migration is applied.",
    )
  }

  throw new ApiError(
    500,
    "REPORT_EXPORT_FAILED",
    "We couldn't prepare this report export. Please try again.",
  )
}

function optionLabel(
  options: readonly ReportOption[],
  group: string,
  id: string | undefined,
  fallback: string,
) {
  if (!id) return fallback
  return options.find((option) => option.option_group === group && option.option_id === id)
    ?.option_label ?? "Selected option"
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function rangeFields(input: ReportExportQuery): ReportExportField[] {
  return [
    { kind: "date", label: "Start date", value: input.startDate },
    { kind: "date", label: "End date", value: input.endDate },
  ]
}

function detailScopeField(rows: readonly { total_count: number }[]) {
  const total = numberValue(rows[0]?.total_count)
  const included = Math.min(total, detailExportLimit)

  return {
    label: "Detail rows",
    value: total > detailExportLimit
      ? `${included.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} matching rows (export limit)`
      : `${included.toLocaleString("en-US")} matching rows`,
  } satisfies ReportExportField
}

function reportDocumentBase(
  title: string,
  fileStem: string,
  businessName: string,
  currencyCode: string,
  timeZone: string,
) {
  return {
    businessName,
    currencyCode,
    fileStem,
    generatedAt: new Date().toISOString(),
    timeZone,
    title,
  }
}

async function getSalesExport(
  input: ReportExportQuery,
  business: { id: string; name: string },
  settings: { currency_code: string; timezone: string },
  options: readonly ReportOption[],
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ReportExportDocument> {
  const filters = {
    range_end: input.endDate,
    range_start: input.startDate,
    selected_category_id: input.categoryId,
    selected_payment_method: input.paymentMethod,
    selected_product_id: input.productId,
    selected_staff_id: input.staffId,
    target_business_id: business.id,
  }
  const [summaryResult, rowsResult] = await Promise.all([
    supabase.rpc("get_sales_report_summary", filters).single(),
    supabase.rpc("search_sales_report", {
      ...filters,
      result_limit: detailExportLimit,
      result_offset: 0,
    }),
  ])

  if (summaryResult.error) throwQueryError("sales summary query", summaryResult.error)
  if (rowsResult.error) throwQueryError("sales detail query", rowsResult.error)

  const summary = summaryResult.data as SalesSummary | null
  const rows = (rowsResult.data ?? []) as SalesRow[]
  const currencyCode = summary?.currency_code ?? settings.currency_code
  const exportFilters: ReportExportField[] = [
    ...rangeFields(input),
    {
      label: "Product",
      value: optionLabel(options, "product", input.productId, "All products"),
    },
    {
      label: "Category",
      value: optionLabel(options, "category", input.categoryId, "All categories"),
    },
    {
      label: "Staff",
      value: optionLabel(options, "staff", input.staffId, "All staff"),
    },
    {
      label: "Payment method",
      value: optionLabel(
        options,
        "payment_method",
        input.paymentMethod,
        "All payment methods",
      ),
    },
    detailScopeField(rows),
  ]
  const sections: ReportExportSection[] = [{
    columns: [
      { kind: "date", label: "Date", width: 0.9 },
      { label: "Sale", width: 1 },
      { label: "Customer", width: 1.2 },
      { label: "Product", width: 1.6 },
      { label: "Category", width: 1 },
      { label: "Staff", width: 1.1 },
      { label: "Payment", width: 0.9 },
      { align: "right", kind: "quantity", label: "Qty", width: 0.55 },
      { align: "right", kind: "currency", label: "Unit price", width: 1 },
      { align: "right", kind: "currency", label: "Discount", width: 0.9 },
      { align: "right", kind: "currency", label: "Revenue", width: 1 },
      { align: "right", kind: "currency", label: "COGS", width: 0.9 },
      { align: "right", kind: "currency", label: "Gross profit", width: 1 },
    ],
    emptyMessage: "No completed sales matched these filters.",
    rows: rows.map((row) => [
      row.sale_date,
      row.sale_number,
      row.customer_name ?? "Walk-in customer",
      row.variant_name ? `${row.product_name} - ${row.variant_name}` : row.product_name,
      row.category_name ?? "Uncategorized",
      row.staff_name,
      humanize(row.payment_method),
      numberValue(row.quantity),
      numberValue(row.unit_price),
      numberValue(row.discount_amount),
      numberValue(row.revenue),
      numberValue(row.cogs),
      numberValue(row.gross_profit),
    ]),
    title: "Sales detail",
  }]

  return {
    ...reportDocumentBase(
      "Sales report",
      `sales-report-${input.startDate}-to-${input.endDate}`,
      business.name,
      currencyCode,
      settings.timezone,
    ),
    filters: exportFilters,
    metrics: [
      { kind: "currency", label: "Revenue", value: numberValue(summary?.revenue) },
      { kind: "currency", label: "COGS", value: numberValue(summary?.cogs) },
      { kind: "currency", label: "Gross profit", value: numberValue(summary?.gross_profit) },
      { kind: "integer", label: "Transactions", value: numberValue(summary?.transaction_count) },
      { kind: "quantity", label: "Units sold", value: numberValue(summary?.units_sold) },
      { kind: "currency", label: "Average sale", value: numberValue(summary?.average_sale) },
    ],
    sections,
  }
}

async function getInventoryExport(
  input: ReportExportQuery,
  business: { id: string; name: string },
  settings: { currency_code: string; timezone: string },
  options: readonly ReportOption[],
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ReportExportDocument> {
  const view = input.view && ["current-stock", "stock-movement", "stock-valuation"].includes(input.view)
    ? input.view
    : "current-stock"
  const summaryResult = await supabase.rpc("get_inventory_report_summary", {
    selected_category_id: input.categoryId,
    target_business_id: business.id,
  }).single()

  if (summaryResult.error) throwQueryError("inventory summary query", summaryResult.error)

  const summary = summaryResult.data as InventorySummary | null
  const currencyCode = summary?.currency_code ?? settings.currency_code
  const commonMetrics: ReportExportField[] = [
    { kind: "integer", label: "Products", value: numberValue(summary?.total_products) },
    { kind: "quantity", label: "Units in stock", value: numberValue(summary?.total_units) },
    { kind: "currency", label: "Stock value", value: numberValue(summary?.inventory_value) },
    { kind: "integer", label: "Low stock", value: numberValue(summary?.low_stock_count) },
    { kind: "integer", label: "Out of stock", value: numberValue(summary?.out_of_stock_count) },
  ]

  if (view === "stock-movement") {
    const rowsResult = await supabase.rpc("search_inventory_movement_report", {
      range_end: input.endDate,
      range_start: input.startDate,
      result_limit: detailExportLimit,
      result_offset: 0,
      selected_category_id: input.categoryId,
      selected_movement_type: undefined,
      selected_product_id: input.productId,
      target_business_id: business.id,
    })
    if (rowsResult.error) throwQueryError("inventory movement query", rowsResult.error)

    const rows = (rowsResult.data ?? []) as InventoryMovementRow[]
    return {
      ...reportDocumentBase(
        "Inventory movement report",
        `inventory-movement-report-${input.startDate}-to-${input.endDate}`,
        business.name,
        currencyCode,
        settings.timezone,
      ),
      filters: [
        ...rangeFields(input),
        {
          label: "Product",
          value: optionLabel(options, "product", input.productId, "All products"),
        },
        {
          label: "Category",
          value: optionLabel(options, "category", input.categoryId, "All categories"),
        },
        detailScopeField(rows),
      ],
      metrics: commonMetrics,
      sections: [{
        columns: [
          { kind: "datetime", label: "Occurred", width: 1.15 },
          { label: "Product", width: 1.6 },
          { label: "SKU", width: 0.9 },
          { label: "Category", width: 1 },
          { label: "Location", width: 1 },
          { label: "Movement", width: 1 },
          { align: "right", kind: "quantity", label: "Quantity", width: 0.8 },
          { align: "right", kind: "currency", label: "Unit cost", width: 0.9 },
          { align: "right", kind: "currency", label: "Value", width: 0.9 },
          { label: "Staff", width: 1 },
          { label: "Note", width: 1.5 },
        ],
        emptyMessage: "No inventory movements matched this date range.",
        rows: rows.map((row) => [
          row.occurred_at,
          row.variant_name ? `${row.product_name} - ${row.variant_name}` : row.product_name,
          row.product_sku,
          row.category_name ?? "Uncategorized",
          row.location_name,
          humanize(row.movement_type),
          numberValue(row.quantity_delta),
          row.unit_cost === null ? null : numberValue(row.unit_cost),
          row.movement_value === null ? null : numberValue(row.movement_value),
          row.staff_name,
          row.note,
        ]),
        title: "Stock movement",
      }],
    }
  }

  const rowsResult = await supabase.rpc("search_inventory_stock_report", {
    result_limit: detailExportLimit,
    result_offset: 0,
    selected_category_id: input.categoryId,
    target_business_id: business.id,
  })
  if (rowsResult.error) throwQueryError("inventory stock query", rowsResult.error)

  const rows = (rowsResult.data ?? []) as InventoryStockRow[]
  const valuation = view === "stock-valuation"
  const filters: ReportExportField[] = [
    { label: "View", value: valuation ? "Stock valuation" : "Current stock" },
    { kind: "date", label: "As of", value: dateInTimeZone(settings.timezone) },
    {
      label: "Category",
      value: optionLabel(options, "category", input.categoryId, "All categories"),
    },
    detailScopeField(rows),
  ]

  return {
    ...reportDocumentBase(
      valuation ? "Inventory valuation report" : "Current stock report",
      `${valuation ? "inventory-valuation" : "current-stock"}-report-${dateInTimeZone(settings.timezone)}`,
      business.name,
      currencyCode,
      settings.timezone,
    ),
    filters,
    metrics: commonMetrics,
    sections: [{
      columns: valuation
        ? [
            { label: "Product", width: 1.8 },
            { label: "SKU", width: 1 },
            { label: "Category", width: 1.2 },
            { align: "right", kind: "quantity", label: "Stock", width: 0.8 },
            { align: "right", kind: "currency", label: "Unit cost", width: 1 },
            { align: "right", kind: "currency", label: "Stock value", width: 1.1 },
          ]
        : [
            { label: "Product", width: 1.8 },
            { label: "SKU", width: 1 },
            { label: "Category", width: 1.2 },
            { align: "right", kind: "quantity", label: "Current stock", width: 1 },
            { align: "right", kind: "quantity", label: "Reorder level", width: 1 },
            { label: "Status", width: 1 },
          ],
      emptyMessage: "No inventory products matched these filters.",
      rows: valuation
        ? rows.map((row) => [
            row.product_name,
            row.product_sku,
            row.category_name ?? "Uncategorized",
            numberValue(row.stock_quantity),
            numberValue(row.unit_cost),
            numberValue(row.stock_value),
          ])
        : rows.map((row) => [
            row.product_name,
            row.product_sku,
            row.category_name ?? "Uncategorized",
            numberValue(row.stock_quantity),
            numberValue(row.reorder_level),
            row.tracks_inventory ? humanize(row.stock_status) : "Not tracked",
          ]),
      title: valuation ? "Stock valuation" : "Current stock",
    }],
  }
}

async function getExpenseExport(
  input: ReportExportQuery,
  business: { id: string; name: string },
  settings: { currency_code: string; timezone: string },
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ReportExportDocument> {
  const view = input.view === "date" ? "date" : "category"
  const request = view === "date"
    ? supabase.rpc("get_expense_report_by_date", {
        range_end: input.endDate,
        range_start: input.startDate,
        target_business_id: business.id,
      })
    : supabase.rpc("get_expense_report_by_category", {
        range_end: input.endDate,
        range_start: input.startDate,
        target_business_id: business.id,
      })
  const result = await request

  if (result.error) throwQueryError("expense report query", result.error)

  const rows = result.data ?? []
  const categoryRows = view === "category" ? rows as ExpenseCategoryRow[] : []
  const dateRows = view === "date" ? rows as ExpenseDateRow[] : []
  const totalAmount = (view === "category" ? categoryRows : dateRows)
    .reduce((total, row) => total + numberValue(row.total_amount), 0)
  const expenseCount = (view === "category" ? categoryRows : dateRows)
    .reduce((total, row) => total + numberValue(row.expense_count), 0)
  const sections: ReportExportSection[] = view === "category"
    ? [{
        columns: [
          { label: "Category", width: 1.7 },
          { align: "right", kind: "integer", label: "Expenses", width: 0.8 },
          { align: "right", kind: "currency", label: "Amount", width: 1 },
          { align: "right", kind: "number", label: "Share (%)", width: 0.8 },
        ],
        emptyMessage: "No recorded expenses matched this date range.",
        rows: categoryRows.map((row) => [
          row.category_name,
          numberValue(row.expense_count),
          numberValue(row.total_amount),
          numberValue(row.percentage_of_total),
        ]),
        title: "Expenses by category",
      }]
    : [{
        columns: [
          { kind: "date", label: "Date", width: 1.2 },
          { align: "right", kind: "integer", label: "Expenses", width: 0.8 },
          { align: "right", kind: "currency", label: "Amount", width: 1 },
        ],
        emptyMessage: "No recorded expenses matched this date range.",
        rows: dateRows.map((row) => [
          row.expense_date,
          numberValue(row.expense_count),
          numberValue(row.total_amount),
        ]),
        title: "Expenses by date",
      }]

  return {
    ...reportDocumentBase(
      "Expense report",
      `expense-report-by-${view}-${input.startDate}-to-${input.endDate}`,
      business.name,
      rows[0]?.currency_code ?? settings.currency_code,
      settings.timezone,
    ),
    filters: [
      ...rangeFields(input),
      { label: "Grouped by", value: view === "category" ? "Category" : "Date" },
    ],
    metrics: [
      { kind: "currency", label: "Total expenses", value: totalAmount },
      { kind: "integer", label: "Expense entries", value: expenseCount },
      {
        kind: "integer",
        label: view === "category" ? "Categories" : "Active dates",
        value: rows.length,
      },
    ],
    sections,
  }
}

async function getProfitExport(
  input: ReportExportQuery,
  business: { id: string; name: string },
  settings: { currency_code: string; timezone: string },
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ReportExportDocument> {
  const filters = {
    range_end: input.endDate,
    range_start: input.startDate,
    target_business_id: business.id,
  }
  const [summaryResult, rowsResult] = await Promise.all([
    supabase.rpc("get_profit_report_summary", filters).single(),
    supabase.rpc("get_profit_report_by_date", filters),
  ])

  if (summaryResult.error) throwQueryError("profit summary query", summaryResult.error)
  if (rowsResult.error) throwQueryError("profit detail query", rowsResult.error)

  const summary = summaryResult.data as ProfitSummary | null
  const rows = (rowsResult.data ?? []) as ProfitDateRow[]
  const currencyCode = summary?.currency_code ?? settings.currency_code

  return {
    ...reportDocumentBase(
      "Profit report",
      `profit-report-${input.startDate}-to-${input.endDate}`,
      business.name,
      currencyCode,
      settings.timezone,
    ),
    filters: rangeFields(input),
    metrics: [
      { kind: "currency", label: "Revenue", value: numberValue(summary?.revenue) },
      { kind: "currency", label: "COGS", value: numberValue(summary?.cogs) },
      { kind: "currency", label: "Expenses", value: numberValue(summary?.expenses) },
      { kind: "currency", label: "Gross profit", value: numberValue(summary?.gross_profit) },
      { kind: "currency", label: "Net profit", value: numberValue(summary?.net_profit) },
    ],
    sections: [{
      columns: [
        { kind: "date", label: "Date", width: 1 },
        { align: "right", kind: "currency", label: "Revenue", width: 1 },
        { align: "right", kind: "currency", label: "COGS", width: 1 },
        { align: "right", kind: "currency", label: "Expenses", width: 1 },
        { align: "right", kind: "currency", label: "Gross profit", width: 1 },
        { align: "right", kind: "currency", label: "Net profit", width: 1 },
      ],
      emptyMessage: "No recognized sales or recorded expenses matched this date range.",
      rows: rows.map((row) => [
        row.report_date,
        numberValue(row.revenue),
        numberValue(row.cogs),
        numberValue(row.expenses),
        numberValue(row.gross_profit),
        numberValue(row.net_profit),
      ]),
      title: "Profit by date",
    }],
  }
}

export async function getReportExportDocument(
  input: ReportExportQuery,
): Promise<ReportExportDocument> {
  const user = await getCurrentUser()
  if (!user) {
    throw new ApiError(
      401,
      "AUTH_REQUIRED",
      "Sign in again before exporting a report.",
    )
  }

  const business = await getCurrentBusinessOrNull()
  if (!business) {
    throw new ApiError(
      403,
      "BUSINESS_REQUIRED",
      "Join or create a business before exporting reports.",
    )
  }
  const supabase = await createClient()
  const [settingsResult, optionsResult] = await Promise.all([
    supabase.from("businesses")
      .select("currency_code, timezone")
      .eq("id", business.id)
      .single(),
    supabase.rpc("get_report_filter_options", {
      target_business_id: business.id,
    }),
  ])

  if (settingsResult.error) throwQueryError("business settings query", settingsResult.error)
  if (optionsResult.error) throwQueryError("filter options query", optionsResult.error)
  if (!settingsResult.data) {
    throw new ApiError(
      500,
      "REPORT_EXPORT_FAILED",
      "We couldn't prepare this report export. Please try again.",
    )
  }

  const settings = settingsResult.data
  const options = (optionsResult.data ?? []) as ReportOption[]
  validateRange(input, settings.timezone)

  if (input.report === "sales") {
    return getSalesExport(input, business, settings, options, supabase)
  }
  if (input.report === "inventory") {
    return getInventoryExport(input, business, settings, options, supabase)
  }
  if (input.report === "expenses") {
    return getExpenseExport(input, business, settings, supabase)
  }

  return getProfitExport(input, business, settings, supabase)
}
