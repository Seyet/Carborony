import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { createClient } from "@/lib/supabase/server"
import type {
  ExpenseListItem,
  ExpensePageData,
  ExpensePaymentMethod,
  ExpenseStatus,
} from "../types"

export const expensesPageSize = 20

export class ExpensesSetupRequiredError extends Error {
  constructor() {
    super("The expense management migration has not been applied.")
    this.name = "ExpensesSetupRequiredError"
  }
}

export type ExpensePageFilters = {
  categoryId: string
  page: number
  paymentMethod: string
  query: string
}

function isSetupError(code: string) {
  return ["PGRST202", "PGRST204", "PGRST205"].includes(code)
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

function mapAttachment(expense: {
  attachment_file_name: string | null
  attachment_file_size: number | null
  attachment_mime_type: string | null
}) {
  if (
    !expense.attachment_file_name
    || expense.attachment_file_size === null
    || !expense.attachment_mime_type
  ) {
    return null
  }

  return {
    fileName: expense.attachment_file_name,
    fileSize: Number(expense.attachment_file_size),
    mimeType: expense.attachment_mime_type,
  }
}

export async function getExpensesPageData(
  filters: ExpensePageFilters,
): Promise<ExpensePageData> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const [
    businessResult,
    categoriesResult,
    staffResult,
    metricsResult,
    expensesResult,
  ] = await Promise.all([
    supabase.from("businesses")
      .select("currency_code, timezone")
      .eq("id", business.id)
      .single(),
    supabase.from("expense_categories")
      .select("id, name")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("name"),
    supabase.rpc("get_expense_staff_options", {
      target_business_id: business.id,
    }),
    supabase.rpc("get_expense_metrics", {
      target_business_id: business.id,
    }).single(),
    supabase.rpc("search_business_expenses", {
      result_limit: expensesPageSize,
      result_offset: (filters.page - 1) * expensesPageSize,
      search_query: filters.query || undefined,
      selected_category_id: filters.categoryId || undefined,
      selected_payment_method: filters.paymentMethod || undefined,
      target_business_id: business.id,
    }),
  ])

  const firstError = [
    businessResult,
    categoriesResult,
    staffResult,
    metricsResult,
    expensesResult,
  ].find((result) => result.error)?.error

  if (firstError) {
    if (isSetupError(firstError.code)) {
      throw new ExpensesSetupRequiredError()
    }
    throw new Error("Unable to load expenses.", { cause: firstError })
  }

  const rows = expensesResult.data ?? []
  const totalCount = Number(rows[0]?.total_count ?? 0)
  const timezone = businessResult.data?.timezone ?? "Africa/Lagos"
  const metrics = metricsResult.data

  return {
    categories: (categoriesResult.data ?? []).map((category) => ({
      id: category.id,
      name: category.name,
    })),
    currencyCode: businessResult.data?.currency_code ?? "NGN",
    items: rows.map((expense): ExpenseListItem => ({
      amount: Number(expense.amount),
      attachment: mapAttachment(expense),
      categoryId: expense.category_id,
      categoryName: expense.category_name,
      createdAt: expense.created_at,
      currencyCode: expense.currency_code,
      date: expense.expense_date,
      description: expense.description,
      id: expense.expense_id,
      name: expense.expense_name,
      paymentMethod: expense.payment_method as ExpensePaymentMethod,
      staffMemberId: expense.staff_member_id,
      staffMemberName: expense.staff_member_name,
      status: expense.status as ExpenseStatus,
    })),
    metrics: {
      recordedTotal: Number(metrics?.recorded_total ?? 0),
      thisMonthTotal: Number(metrics?.this_month_total ?? 0),
      topCategoryName: metrics?.top_category_name ?? null,
      totalCount: Number(metrics?.total_count ?? 0),
    },
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(totalCount / expensesPageSize)),
    staffMembers: (staffResult.data ?? []).map((staff) => ({
      id: staff.staff_member_id,
      name: staff.full_name,
      roleName: staff.role_name,
    })),
    timezone,
    todayDate: dateInTimeZone(timezone),
    totalCount,
  }
}
