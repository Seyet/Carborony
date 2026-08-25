import "server-only"

import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database"
import type { StorefrontCheckoutInput } from "../schemas"
import type { StorefrontCheckoutResult } from "../types"

const safeMessages = new Set([
  "A checkout reference is required.",
  "A selected product does not have enough stock.",
  "A selected product is no longer available online.",
  "A selected product is unavailable.",
  "A selected product variant is unavailable.",
  "Add at least one product to the sale.",
  "Choose a variant for every applicable product.",
  "Enter a valid customer contact details.",
  "Enter a valid delivery address.",
  "Enter a valid product quantity.",
  "Enter valid customer contact details.",
  "Each product option can appear only once in the cart.",
  "Order notes must be 500 characters or fewer.",
  "Select an available fulfilment method.",
  "Select an available delivery zone.",
  "Select an available payment method.",
  "Pickup orders do not use a delivery zone.",
  "This storefront is not available.",
])

export async function createStorefrontOrder(input: StorefrontCheckoutInput): Promise<JsonHandlerResult<StorefrontCheckoutResult>> {
  const supabase = await createClient()
  const items: Json = input.items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity,
    variant_id: item.variantId,
  }))
  const { data, error } = await supabase.rpc("create_storefront_order", {
    checkout_buyer_email: input.buyerEmail,
    checkout_buyer_name: input.buyerName,
    checkout_buyer_phone: input.buyerPhone,
    checkout_delivery_address: input.deliveryAddress ?? "",
    checkout_delivery_method: input.deliveryMethod,
    checkout_delivery_zone_id: input.deliveryZoneId,
    checkout_idempotency_key: input.idempotencyKey,
    checkout_items: items,
    checkout_notes: input.notes ?? "",
    checkout_payment_method: input.paymentMethod,
    store_slug: input.slug,
  }).single()

  if (error) {
    if (safeMessages.has(error.message)) throw new ApiError(422, "CHECKOUT_INVALID", error.message)
    if (["42883", "PGRST202", "PGRST204", "PGRST205"].includes(error.code)) throw new ApiError(503, "STOREFRONT_SETUP_REQUIRED", "The storefront is not ready for checkout.")
    throw new ApiError(503, "CHECKOUT_FAILED", "We couldn't place your order. Please try again.")
  }
  if (!data) throw new ApiError(503, "CHECKOUT_FAILED", "We couldn't place your order. Please try again.")
  return {
    data: {
      bankTransferInstructions: data.bank_transfer_instructions,
      currencyCode: data.currency_code,
      orderId: data.order_id,
      orderNumber: data.order_number,
      paymentMethod: data.payment_method,
      totalAmount: Number(data.total_amount),
    },
    message: `Order ${data.order_number} placed successfully.`,
    status: 201,
  }
}
