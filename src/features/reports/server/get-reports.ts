import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { createClient } from "@/lib/supabase/server"
import type {
  ExpenseCategoryReportRow,
  ExpenseDateReportRow,
  ExpenseReportView,
  InventoryMovementReportRow,
  InventoryReportView,
  InventoryStockReportRow,
  ProfitReportRow,
  ReportFilterOptions,
  ReportFilters,
  ReportKind,
  ReportsPageData,
  ReportsQueryInput,
  SalesReportRow,
} from "../types"
import {
  expenseReportViews,
  inventoryReportViews,
  reportKinds,
  reportPaymentMethods,
} from "../types"

export const reportsPageSize = 25

const minimumReportDate = "1900-01-01"
const maximumRangeDays = 3660
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class ReportsSetupRequiredError extends Error {
  constructor() {
    super("The reports database migration has not been applied.")
    this.name = "ReportsSetupRequiredError"
  }
}

type QueryError = {
  code?: string
  message?: string
} | null

function isSetupError(error: QueryError) {
  return Boolean(
    error?.code
    && ["PGRST202", "PGRST204", "PGRST205", "42883", "42P01", "42703"].includes(error.code),
  )
}

function throwReportError(error: QueryError) {
  if (!error) return
  if (isSetupError(error)) throw new ReportsSetupRequiredError()
  throw new Error("Unable to load reports.", { cause: error })
}

function dateInTimeZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(new Date())
  const values = new Map(parts.map((part) => [part.type, part.value]))

  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`
}

function isValidDate(value: string, todayDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)

  return (
    !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value
    && value >= minimumReportDate
    && value <= todayDate
  )
}

function rangeIsAllowed(startDate: string, endDate: string) {
  const milliseconds = Date.parse(`${endDate}T00:00:00Z`)
    - Date.parse(`${startDate}T00:00:00Z`)
  return milliseconds / 86_400_000 < maximumRangeDays
}

function includesValue<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.some((candidate) => candidate === value)
}

function parseReportFilters(
  query: ReportsQueryInput,
  todayDate: string,
): ReportFilters {
  const report: ReportKind = includesValue(reportKinds, query.report ?? "")
    ? query.report as ReportKind
    : "sales"
  const defaultStartDate = `${todayDate.slice(0, 7)}-01`
  const requestedStartDate = query.startDate?.trim() ?? ""
  const requestedEndDate = query.endDate?.trim() ?? ""
  const safeStartDate = isValidDate(requestedStartDate, todayDate)
    ? requestedStartDate
    : defaultStartDate
  const safeEndDate = isValidDate(requestedEndDate, todayDate)
    ? requestedEndDate
    : todayDate
  const [orderedStartDate, orderedEndDate] = safeStartDate <= safeEndDate
    ? [safeStartDate, safeEndDate]
    : [safeEndDate, safeStartDate]
  const [startDate, endDate] = rangeIsAllowed(orderedStartDate, orderedEndDate)
    ? [orderedStartDate, orderedEndDate]
    : [defaultStartDate, todayDate]
  const requestedView = query.view?.trim() ?? ""
  const view = report === "inventory"
    ? includesValue(inventoryReportViews, requestedView)
      ? requestedView as InventoryReportView
      : "current-stock"
    : report === "expenses"
      ? includesValue(expenseReportViews, requestedView)
        ? requestedView as ExpenseReportView
        : "category"
      : ""
  const requestedPage = Number(query.page)
  const page = Number.isSafeInteger(requestedPage)
    && requestedPage > 0
    && requestedPage <= 10_000
    ? requestedPage
    : 1
  const safeUuid = (value: string | undefined) => {
    const normalized = value?.trim() ?? ""
    return uuidPattern.test(normalized) ? normalized : ""
  }
  const requestedPaymentMethod = query.paymentMethod?.trim() ?? ""

  return {
    categoryId: safeUuid(query.categoryId),
    endDate,
    page,
    paymentMethod: includesValue(reportPaymentMethods, requestedPaymentMethod)
      ? requestedPaymentMethod
      : "",
    productId: safeUuid(query.productId),
    report,
    staffId: safeUuid(query.staffId),
    startDate,
    view,
  }
}

function mapFilterOptions(rows: Array<{
  option_detail: string | null
  option_group: string
  option_id: string
  option_label: string
}>): ReportFilterOptions {
  const options: ReportFilterOptions = {
    categories: [],
    paymentMethods: [],
    products: [],
    staff: [],
  }

  for (const row of rows) {
    const option = {
      detail: row.option_detail,
      id: row.option_id,
      label: row.option_label,
    }

    if (row.option_group === "category") options.categories.push(option)
    if (row.option_group === "payment_method") options.paymentMethods.push(option)
    if (row.option_group === "product") options.products.push(option)
    if (row.option_group === "staff") options.staff.push(option)
  }

  return options
}

function pageDetails(totalCount: number, requestedPage: number) {
  return {
    page: requestedPage,
    pageCount: Math.max(1, Math.ceil(totalCount / reportsPageSize)),
    totalCount,
  }
}

export async function getReportsPageData(
  query: ReportsQueryInput,
): Promise<ReportsPageData> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const businessResult = await supabase
    .from("businesses")
    .select("currency_code, timezone")
    .eq("id", business.id)
    .single()

  throwReportError(businessResult.error)

  const currencyCode = businessResult.data?.currency_code ?? "NGN"
  const timezone = businessResult.data?.timezone ?? "Africa/Lagos"
  const todayDate = dateInTimeZone(timezone)
  const filters = parseReportFilters(query, todayDate)
  const optionsRequest = supabase.rpc("get_report_filter_options", {
    target_business_id: business.id,
  })

  if (filters.report === "sales") {
    const args = {
      range_end: filters.endDate,
      range_start: filters.startDate,
      selected_category_id: filters.categoryId || undefined,
      selected_payment_method: filters.paymentMethod || undefined,
      selected_product_id: filters.productId || undefined,
      selected_staff_id: filters.staffId || undefined,
      target_business_id: business.id,
    }
    const [optionsResult, summaryResult, rowsResult] = await Promise.all([
      optionsRequest,
      supabase.rpc("get_sales_report_summary", args).single(),
      supabase.rpc("search_sales_report", {
        ...args,
        result_limit: reportsPageSize,
        result_offset: (filters.page - 1) * reportsPageSize,
      }),
    ])
    throwReportError(optionsResult.error ?? summaryResult.error ?? rowsResult.error)

    const rawRows = rowsResult.data ?? []
    if (rawRows.length === 0 && filters.page > 1) {
      return getReportsPageData({ ...query, page: "1" })
    }

    const totalCount = Number(rawRows[0]?.total_count ?? 0)
    const summary = summaryResult.data
    const rows: SalesReportRow[] = rawRows.map((row) => ({
      categoryId: row.category_id,
      categoryName: row.category_name,
      cogs: Number(row.cogs),
      currencyCode: row.currency_code,
      customerName: row.customer_name,
      discountAmount: Number(row.discount_amount),
      grossProfit: Number(row.gross_profit),
      paymentMethod: row.payment_method,
      productId: row.product_id,
      productName: row.product_name,
      quantity: Number(row.quantity),
      revenue: Number(row.revenue),
      saleDate: row.sale_date,
      saleId: row.sale_id,
      saleItemId: row.sale_item_id,
      saleNumber: row.sale_number,
      staffId: row.staff_id,
      staffName: row.staff_name,
      unitPrice: Number(row.unit_price),
      variantName: row.variant_name,
    }))

    return {
      businessName: business.name,
      currencyCode,
      filters,
      options: mapFilterOptions(optionsResult.data ?? []),
      reportData: {
        kind: "sales",
        ...pageDetails(totalCount, filters.page),
        rows,
        summary: {
          averageSale: Number(summary?.average_sale ?? 0),
          cogs: Number(summary?.cogs ?? 0),
          currencyCode: summary?.currency_code ?? currencyCode,
          grossProfit: Number(summary?.gross_profit ?? 0),
          revenue: Number(summary?.revenue ?? 0),
          transactionCount: Number(summary?.transaction_count ?? 0),
          unitsSold: Number(summary?.units_sold ?? 0),
        },
      },
      timezone,
      todayDate,
    }
  }

  if (filters.report === "inventory") {
    const inventoryView = filters.view as InventoryReportView
    const summaryRequest = supabase.rpc("get_inventory_report_summary", {
      selected_category_id: undefined,
      target_business_id: business.id,
    }).single()
    const listRequest = inventoryView === "stock-movement"
      ? supabase.rpc("search_inventory_movement_report", {
          range_end: filters.endDate,
          range_start: filters.startDate,
          result_limit: reportsPageSize,
          result_offset: (filters.page - 1) * reportsPageSize,
          selected_category_id: undefined,
          selected_movement_type: undefined,
          selected_product_id: undefined,
          target_business_id: business.id,
        })
      : supabase.rpc("search_inventory_stock_report", {
          result_limit: reportsPageSize,
          result_offset: (filters.page - 1) * reportsPageSize,
          selected_category_id: undefined,
          target_business_id: business.id,
        })
    const [optionsResult, summaryResult, rowsResult] = await Promise.all([
      optionsRequest,
      summaryRequest,
      listRequest,
    ])
    throwReportError(optionsResult.error ?? summaryResult.error ?? rowsResult.error)

    const rawRows = rowsResult.data ?? []
    if (rawRows.length === 0 && filters.page > 1) {
      return getReportsPageData({ ...query, page: "1" })
    }

    const totalCount = Number(rawRows[0]?.total_count ?? 0)
    const summary = summaryResult.data
    const stockRows: InventoryStockReportRow[] = inventoryView === "stock-movement"
      ? []
      : (rawRows as Array<{
          category_id: string | null
          category_name: string | null
          currency_code: string
          product_name: string
          product_id: string
          reorder_level: number
          product_sku: string | null
          stock_quantity: number
          stock_status: string
          stock_value: number
          tracks_inventory: boolean
          unit_cost: number
        }>).map((row) => ({
          categoryId: row.category_id,
          categoryName: row.category_name,
          currencyCode: row.currency_code,
          name: row.product_name,
          productId: row.product_id,
          reorderLevel: Number(row.reorder_level),
          sku: row.product_sku,
          stockQuantity: Number(row.stock_quantity),
          stockStatus: row.stock_status,
          stockValue: Number(row.stock_value),
          tracksInventory: row.tracks_inventory,
          unitCost: Number(row.unit_cost),
        }))
    const movementRows: InventoryMovementReportRow[] = inventoryView === "stock-movement"
      ? (rawRows as Array<{
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
          unit_cost: number | null
          variant_name: string | null
        }>).map((row) => ({
          categoryId: row.category_id,
          categoryName: row.category_name,
          currencyCode: row.currency_code,
          locationName: row.location_name,
          movementDate: row.movement_date,
          movementId: row.movement_id,
          movementType: row.movement_type,
          movementValue: row.movement_value === null ? null : Number(row.movement_value),
          note: row.note,
          occurredAt: row.occurred_at,
          productId: row.product_id,
          productName: row.product_name,
          productSku: row.product_sku,
          quantityDelta: Number(row.quantity_delta),
          staffName: row.staff_name,
          unitCost: row.unit_cost === null ? null : Number(row.unit_cost),
          variantName: row.variant_name,
        }))
      : []

    return {
      businessName: business.name,
      currencyCode,
      filters,
      options: mapFilterOptions(optionsResult.data ?? []),
      reportData: {
        kind: "inventory",
        movementRows,
        ...pageDetails(totalCount, filters.page),
        stockRows,
        summary: {
          currencyCode: summary?.currency_code ?? currencyCode,
          inventoryValue: Number(summary?.inventory_value ?? 0),
          lowStockCount: Number(summary?.low_stock_count ?? 0),
          outOfStockCount: Number(summary?.out_of_stock_count ?? 0),
          totalProducts: Number(summary?.total_products ?? 0),
          totalUnits: Number(summary?.total_units ?? 0),
        },
        view: inventoryView,
      },
      timezone,
      todayDate,
    }
  }

  if (filters.report === "expenses") {
    const expenseView = filters.view as ExpenseReportView
    const reportRequest = expenseView === "date"
      ? supabase.rpc("get_expense_report_by_date", {
          range_end: filters.endDate,
          range_start: filters.startDate,
          target_business_id: business.id,
        })
      : supabase.rpc("get_expense_report_by_category", {
          range_end: filters.endDate,
          range_start: filters.startDate,
          target_business_id: business.id,
        })
    const [optionsResult, reportResult] = await Promise.all([
      optionsRequest,
      reportRequest,
    ])
    throwReportError(optionsResult.error ?? reportResult.error)

    const rawRows = reportResult.data ?? []
    const categoryRows: ExpenseCategoryReportRow[] = expenseView === "category"
      ? (rawRows as Array<{
          category_id: string
          category_name: string
          currency_code: string
          expense_count: number
          percentage_of_total: number
          total_amount: number
        }>).map((row) => ({
          categoryId: row.category_id,
          categoryName: row.category_name,
          currencyCode: row.currency_code,
          expenseCount: Number(row.expense_count),
          percentageOfTotal: Number(row.percentage_of_total),
          totalAmount: Number(row.total_amount),
        }))
      : []
    const dateRows: ExpenseDateReportRow[] = expenseView === "date"
      ? (rawRows as Array<{
          currency_code: string
          expense_count: number
          expense_date: string
          total_amount: number
        }>).map((row) => ({
          currencyCode: row.currency_code,
          expenseCount: Number(row.expense_count),
          expenseDate: row.expense_date,
          totalAmount: Number(row.total_amount),
        }))
      : []

    return {
      businessName: business.name,
      currencyCode,
      filters,
      options: mapFilterOptions(optionsResult.data ?? []),
      reportData: {
        categoryRows,
        dateRows,
        kind: "expenses",
        view: expenseView,
      },
      timezone,
      todayDate,
    }
  }

  const [optionsResult, summaryResult, rowsResult] = await Promise.all([
    optionsRequest,
    supabase.rpc("get_profit_report_summary", {
      range_end: filters.endDate,
      range_start: filters.startDate,
      target_business_id: business.id,
    }).single(),
    supabase.rpc("get_profit_report_by_date", {
      range_end: filters.endDate,
      range_start: filters.startDate,
      target_business_id: business.id,
    }),
  ])
  throwReportError(optionsResult.error ?? summaryResult.error ?? rowsResult.error)

  const summary = summaryResult.data
  const rows: ProfitReportRow[] = (rowsResult.data ?? []).map((row) => ({
    cogs: Number(row.cogs),
    currencyCode: row.currency_code,
    expenses: Number(row.expenses),
    grossProfit: Number(row.gross_profit),
    netProfit: Number(row.net_profit),
    reportDate: row.report_date,
    revenue: Number(row.revenue),
  }))

  return {
    businessName: business.name,
    currencyCode,
    filters,
    options: mapFilterOptions(optionsResult.data ?? []),
    reportData: {
      kind: "profit",
      rows,
      summary: {
        cogs: Number(summary?.cogs ?? 0),
        currencyCode: summary?.currency_code ?? currencyCode,
        expenses: Number(summary?.expenses ?? 0),
        grossProfit: Number(summary?.gross_profit ?? 0),
        netProfit: Number(summary?.net_profit ?? 0),
        revenue: Number(summary?.revenue ?? 0),
      },
    },
    timezone,
    todayDate,
  }
}
