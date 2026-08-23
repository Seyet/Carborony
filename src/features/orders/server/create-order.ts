import "server-only"

import { revalidatePath } from "next/cache"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { toPosRpcItems } from "@/features/sales/pos/server/pos-rpc"
import { getCurrentUser } from "@/lib/auth/session"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { createClient } from "@/lib/supabase/server"
import type { CreateManualOrderInput } from "../schemas"
import type { CreateOrderData } from "../types"

const safeMessages = new Set([
  "A selected product is unavailable.",
  "A selected product variant is unavailable.",
  "Add at least one product to the order.",
  "Business configuration is unavailable.",
  "Choose a variant for every applicable product.",
  "Discount cannot exceed the order subtotal.",
  "Delivery address must be between 5 and 500 characters.",
  "Enter a valid buyer name.",
  "Enter a valid buyer phone number.",
  "Enter a valid product quantity.",
  "Enter valid order totals.",
  "Order notes must be 1,000 characters or fewer.",
  "The selected customer is unavailable.",
])

export async function createManualOrder(
  input: CreateManualOrderInput,
): Promise<JsonHandlerResult<CreateOrderData>> {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to create orders.")

  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_manual_order_with_delivery", {
    items: toPosRpcItems(input.items),
    order_buyer_name: input.buyerName,
    order_buyer_phone: input.buyerPhone,
    order_delivery_address: input.deliveryAddress,
    order_discount_amount: input.discountAmount,
    order_notes: input.notes,
    order_shipping_amount: input.shippingAmount,
    selected_customer_id: input.customerId,
    target_business_id: business.id,
  }).single()

  if (error) {
    console.error("Manual order creation failed", { code: error.code, details: error.details, message: error.message })
    if (safeMessages.has(error.message)) throw new ApiError(422, "ORDER_INVALID", error.message)
    if (error.code === "42501") throw new ApiError(403, "ORDER_FORBIDDEN", "You do not have permission to create orders.")
    if (["PGRST202", "PGRST204", "PGRST205"].includes(error.code)) throw new ApiError(503, "ORDERS_SETUP_REQUIRED", "Apply the orders database migration first.")
    throw new ApiError(503, "ORDER_CREATION_FAILED", "We couldn't create this order. Please try again.")
  }
  if (!data) throw new ApiError(503, "ORDER_CREATION_FAILED", "We couldn't create this order. Please try again.")

  revalidatePath("/app/orders")
  revalidatePath("/app/dashboard")
  return {
    data: {
      orderId: data.order_id,
      orderNumber: data.order_number,
      totalAmount: Number(data.total_amount),
    },
    message: `Order ${data.order_number} created successfully.`,
    status: 201,
  }
}
