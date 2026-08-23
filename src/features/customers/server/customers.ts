import "server-only"

import { revalidatePath } from "next/cache"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import type { SaveCustomerInput } from "../schemas"
import type {
  CustomerDetailsData,
  CustomerSegment,
  CustomersPageData,
  SaveCustomerData,
} from "../types"

export const customersPageSize = 20
export const customerHistoryPageSize = 20

export class CustomersSetupRequiredError extends Error {
  constructor() {
    super("The customer CRM migration has not been applied.")
    this.name = "CustomersSetupRequiredError"
  }
}

function isSetupError(code: string) {
  return ["PGRST202", "PGRST204", "PGRST205"].includes(code)
}

export async function getCustomers(filters: {
  page: number
  query: string
  segment: string
}): Promise<CustomersPageData> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const [businessResult, customersResult, segmentsResult] = await Promise.all([
    supabase.from("businesses").select("currency_code, timezone")
      .eq("id", business.id).single(),
    supabase.rpc("search_crm_customers", {
      result_limit: customersPageSize,
      result_offset: (filters.page - 1) * customersPageSize,
      search_query: filters.query || undefined,
      selected_segment: filters.segment || undefined,
      target_business_id: business.id,
    }),
    supabase.rpc("get_customer_segment_metrics", {
      target_business_id: business.id,
    }),
  ])

  const firstError = [businessResult, customersResult, segmentsResult]
    .find((result) => result.error)?.error
  if (firstError) {
    if (isSetupError(firstError.code)) throw new CustomersSetupRequiredError()
    throw new Error("Unable to load customers.", { cause: firstError })
  }

  const totalCount = Number(customersResult.data?.[0]?.total_count ?? 0)
  return {
    currencyCode: businessResult.data?.currency_code ?? "NGN",
    items: (customersResult.data ?? []).map((customer) => ({
      averageOrder: Number(customer.average_order),
      email: customer.email,
      id: customer.customer_id,
      lastProductName: customer.last_product_name,
      lastPurchaseAt: customer.last_purchase_at,
      name: customer.full_name,
      phone: customer.phone,
      purchaseCount: Number(customer.purchase_count),
      segment: customer.customer_segment as CustomerSegment,
      tags: customer.customer_tags,
      totalSpent: Number(customer.total_spent),
    })),
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(totalCount / customersPageSize)),
    segmentMetrics: (segmentsResult.data ?? []).map((metric) => ({
      count: Number(metric.customer_count),
      revenue: Number(metric.total_revenue),
      segment: metric.customer_segment as CustomerSegment,
    })),
    timezone: businessResult.data?.timezone ?? "Africa/Lagos",
    totalCount,
  }
}

export async function getCustomerDetails(
  customerId: string,
  historyPage: number,
): Promise<CustomerDetailsData> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const [businessResult, profileResult, historyResult] = await Promise.all([
    supabase.from("businesses").select("currency_code, timezone")
      .eq("id", business.id).single(),
    supabase.rpc("get_crm_customer_profile", {
      target_business_id: business.id,
      target_customer_id: customerId,
    }).maybeSingle(),
    supabase.rpc("get_customer_purchase_history", {
      result_limit: customerHistoryPageSize,
      result_offset: (historyPage - 1) * customerHistoryPageSize,
      target_business_id: business.id,
      target_customer_id: customerId,
    }),
  ])

  const firstError = [businessResult, profileResult, historyResult]
    .find((result) => result.error)?.error
  if (firstError) {
    if (isSetupError(firstError.code)) throw new CustomersSetupRequiredError()
    throw new Error("Unable to load this customer.", { cause: firstError })
  }
  if (!profileResult.data) {
    throw new ApiError(404, "CUSTOMER_NOT_FOUND", "This customer could not be found.")
  }

  const customer = profileResult.data
  const historyTotalCount = Number(historyResult.data?.[0]?.total_count ?? 0)
  return {
    currencyCode: businessResult.data?.currency_code ?? "NGN",
    history: (historyResult.data ?? []).map((purchase) => ({
      currencyCode: purchase.currency_code,
      id: purchase.document_id,
      issuedAt: purchase.issued_at,
      kind: purchase.document_kind,
      number: purchase.document_number,
      paymentStatus: purchase.payment_status,
      productName: purchase.first_product_name,
      status: purchase.document_status,
      totalAmount: Number(purchase.total_amount),
    })),
    historyPage,
    historyPageCount: Math.max(1, Math.ceil(historyTotalCount / customerHistoryPageSize)),
    historyTotalCount,
    profile: {
      address: customer.address,
      averageOrder: Number(customer.average_order ?? 0),
      birthday: customer.birthday,
      createdAt: customer.created_at,
      email: customer.email,
      id: customer.customer_id,
      lastProductName: customer.last_product_name,
      lastPurchaseAt: customer.last_purchase_at,
      name: customer.full_name,
      notes: customer.notes,
      phone: customer.phone,
      purchaseCount: Number(customer.purchase_count ?? 0),
      segment: customer.customer_segment as CustomerSegment,
      source: customer.customer_source,
      tags: customer.customer_tags,
      totalSpent: Number(customer.total_spent ?? 0),
    },
    timezone: businessResult.data?.timezone ?? "Africa/Lagos",
  }
}

const safeMessages = new Set([
  "A customer with this phone number or email already exists.",
  "Customer address must be between 5 and 500 characters.",
  "Customer name must be between 2 and 120 characters.",
  "Customer notes must be 2,000 characters or fewer.",
  "Enter a phone number or email address.",
  "Enter a valid customer birthday.",
  "Enter a valid customer email address.",
  "Enter a valid customer phone number.",
  "Select a valid customer segment.",
  "This customer could not be found.",
  "Use no more than 20 customer tags.",
])

export async function saveCustomer(
  input: SaveCustomerInput,
  customerId: string | null,
): Promise<JsonHandlerResult<SaveCustomerData>> {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to manage customers.")
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("save_crm_customer", {
    customer_profile: {
      address: input.address,
      birthday: input.birthday,
      email: input.email,
      full_name: input.fullName,
      notes: input.notes,
      phone: input.phone,
      segment: input.segment,
      tags: input.tags,
    },
    target_business_id: business.id,
    target_customer_id: customerId,
  }).single()

  if (error) {
    console.error("Customer persistence failed", { code: error.code, message: error.message })
    if (safeMessages.has(error.message)) throw new ApiError(422, "CUSTOMER_INVALID", error.message)
    if (error.code === "42501") throw new ApiError(403, "CUSTOMER_FORBIDDEN", "You do not have permission to manage customers.")
    if (isSetupError(error.code)) throw new ApiError(503, "CUSTOMERS_SETUP_REQUIRED", "Apply the customer CRM migration first.")
    throw new ApiError(503, "CUSTOMER_SAVE_FAILED", "We couldn't save this customer. Please try again.")
  }
  if (!data) throw new ApiError(503, "CUSTOMER_SAVE_FAILED", "We couldn't save this customer. Please try again.")

  revalidatePath("/app/customers")
  revalidatePath(`/app/customers/${data.customer_id}`)
  return {
    data: { customerId: data.customer_id, wasCreated: data.was_created },
    message: data.was_created ? "Customer created successfully." : "Customer updated successfully.",
    status: data.was_created ? 201 : 200,
  }
}
