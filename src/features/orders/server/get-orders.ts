import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { ApiError } from "@/lib/api/server"
import { createClient } from "@/lib/supabase/server"
import type { OrderDetailsData, OrderStatus, OrdersPageData } from "../types"

export const ordersPageSize = 20

export class OrdersSetupRequiredError extends Error {
  constructor() {
    super("The orders database migration has not been applied.")
    this.name = "OrdersSetupRequiredError"
  }
}

function isSetupError(code: string) {
  return ["PGRST202", "PGRST204", "PGRST205"].includes(code)
}

export async function getOrders(filters: {
  channel: string
  page: number
  query: string
  status: string
}): Promise<OrdersPageData> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const [businessResult, metricsResult, ordersResult] = await Promise.all([
    supabase.from("businesses").select("timezone").eq("id", business.id).single(),
    supabase.rpc("get_order_metrics", { target_business_id: business.id }).single(),
    supabase.rpc("search_business_orders", {
      result_limit: ordersPageSize,
      result_offset: (filters.page - 1) * ordersPageSize,
      search_query: filters.query || undefined,
      selected_channel: filters.channel || undefined,
      selected_status: filters.status || undefined,
      target_business_id: business.id,
    }),
  ])

  const firstError = [businessResult, metricsResult, ordersResult]
    .find((result) => result.error)?.error
  if (firstError) {
    if (isSetupError(firstError.code)) throw new OrdersSetupRequiredError()
    throw new Error("Unable to load orders.", { cause: firstError })
  }

  const totalCount = Number(ordersResult.data?.[0]?.total_count ?? 0)
  const metrics = metricsResult.data
  return {
    items: (ordersResult.data ?? []).map((order) => ({
      buyerName: order.buyer_name,
      buyerPhone: order.buyer_phone,
      channel: order.order_channel,
      currencyCode: order.currency_code,
      id: order.order_id,
      itemCount: Number(order.item_count),
      number: order.order_number,
      paymentStatus: order.payment_status,
      placedAt: order.placed_at,
      status: order.order_status as OrderStatus,
      totalAmount: Number(order.total_amount),
    })),
    metrics: {
      completed: Number(metrics?.completed_orders ?? 0),
      pending: Number(metrics?.pending_orders ?? 0),
      processing: Number(metrics?.processing_orders ?? 0),
      ready: Number(metrics?.ready_orders ?? 0),
      total: Number(metrics?.total_orders ?? 0),
    },
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(totalCount / ordersPageSize)),
    timezone: businessResult.data?.timezone ?? "Africa/Lagos",
    totalCount,
  }
}

export async function getOrderDetails(orderId: string): Promise<OrderDetailsData> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const orderResult = await supabase.from("orders")
    .select("id, customer_id, buyer_name, buyer_phone, delivery_address, delivery_zone_name, order_number, channel, status, payment_status, fulfillment_status, currency_code, subtotal_amount, discount_amount, tax_amount, shipping_amount, total_amount, notes, placed_at, completed_at")
    .eq("business_id", business.id)
    .eq("document_type", "order")
    .eq("id", orderId)
    .maybeSingle()

  if (orderResult.error) {
    if (isSetupError(orderResult.error.code)) throw new OrdersSetupRequiredError()
    throw new Error("Unable to load this order.", { cause: orderResult.error })
  }
  if (!orderResult.data) throw new ApiError(404, "ORDER_NOT_FOUND", "This order could not be found.")

  const order = orderResult.data
  const [itemsResult, historyResult, customerResult, settingsResult] = await Promise.all([
    supabase.from("order_items")
      .select("id, item_source, product_name, variant_name, sku, quantity, unit_price, discount_amount, line_total")
      .eq("business_id", business.id)
      .eq("order_id", order.id)
      .order("created_at"),
    supabase.from("order_status_history")
      .select("id, previous_status, new_status, note, changed_by, created_at")
      .eq("business_id", business.id)
      .eq("order_id", order.id)
      .order("created_at", { ascending: false }),
    order.customer_id
      ? supabase.from("customers").select("full_name, email, phone")
          .eq("business_id", business.id).eq("id", order.customer_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("businesses")
      .select("date_format, locale, time_format, timezone")
      .eq("id", business.id)
      .single(),
  ])

  const firstError = itemsResult.error ?? historyResult.error ?? customerResult.error ?? settingsResult.error
  if (firstError) {
    if (isSetupError(firstError.code)) throw new OrdersSetupRequiredError()
    throw new Error("Unable to load order details.", { cause: firstError })
  }

  const customer = customerResult.data
  return {
    buyerEmail: customer?.email ?? null,
    buyerName: order.buyer_name ?? customer?.full_name ?? "Walk-in customer",
    buyerPhone: order.buyer_phone ?? customer?.phone ?? null,
    channel: order.channel,
    completedAt: order.completed_at,
    currencyCode: order.currency_code,
    deliveryAddress: order.delivery_address,
    deliveryZoneName: order.delivery_zone_name,
    discountAmount: Number(order.discount_amount),
    fulfillmentStatus: order.fulfillment_status,
    formatting: {
      dateFormat: settingsResult.data?.date_format as OrderDetailsData["formatting"]["dateFormat"] ?? "day_month_year",
      locale: settingsResult.data?.locale ?? "en-NG",
      timeFormat: settingsResult.data?.time_format as OrderDetailsData["formatting"]["timeFormat"] ?? "12h",
      timeZone: settingsResult.data?.timezone ?? "Africa/Lagos",
    },
    history: (historyResult.data ?? []).map((entry) => ({
      changedBy: entry.changed_by ? "Team member" : "Storefront customer",
      createdAt: entry.created_at,
      id: entry.id,
      newStatus: entry.new_status,
      note: entry.note,
      previousStatus: entry.previous_status,
    })),
    id: order.id,
    items: (itemsResult.data ?? []).map((item) => ({
      discountAmount: Number(item.discount_amount),
      id: item.id,
      itemSource: item.item_source,
      lineTotal: Number(item.line_total),
      name: item.product_name,
      quantity: Number(item.quantity),
      sku: item.sku,
      unitPrice: Number(item.unit_price),
      variantName: item.variant_name,
    })),
    notes: order.notes,
    number: order.order_number,
    paymentStatus: order.payment_status,
    placedAt: order.placed_at,
    shippingAmount: Number(order.shipping_amount),
    status: order.status as OrderStatus,
    subtotalAmount: Number(order.subtotal_amount),
    taxAmount: Number(order.tax_amount),
    totalAmount: Number(order.total_amount),
  }
}
