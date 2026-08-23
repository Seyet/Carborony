import "server-only"

import { ApiError } from "@/lib/api/server"
import type { Json } from "@/types/database"
import type { PosItemInput } from "../schemas"

const safeDatabaseMessages = new Set([
  "Add at least one product to the sale.",
  "A selected product is unavailable.",
  "A selected product variant is unavailable.",
  "Choose a variant for every applicable product.",
  "Discount cannot exceed the sale subtotal.",
  "Enter a valid discount.",
  "Enter a valid buyer name.",
  "Enter a valid buyer phone number.",
  "Enter a valid product quantity.",
  "Enter valid external product details.",
  "Select a valid payment method.",
  "There is not enough stock to complete this sale.",
  "The selected customer is unavailable.",
])

export function toPosRpcItems(items: PosItemInput[]): Json {
  return items.map((item) => item.source === "catalogue"
    ? {
        product_id: item.productId,
        quantity: item.quantity,
        variant_id: item.variantId,
      }
    : {
        external_name: item.name,
        external_sku: item.sku,
        product_id: null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        variant_id: null,
      })
}

export function throwPosRpcError(
  error: { code: string; details?: string | null; message: string },
  operation: "invoice" | "sale",
): never {
  console.error(`POS ${operation} creation failed`, {
    code: error.code,
    details: error.details,
    message: error.message,
  })

  if (safeDatabaseMessages.has(error.message)) {
    throw new ApiError(422, "TRANSACTION_VALIDATION_FAILED", error.message)
  }
  if (error.message === "This operation would make stock negative.") {
    throw new ApiError(
      422,
      "TRANSACTION_VALIDATION_FAILED",
      "There is not enough stock to complete this sale.",
    )
  }
  if (error.code === "42501") {
    throw new ApiError(
      403,
      "TRANSACTION_FORBIDDEN",
      `You do not have permission to create this ${operation}.`,
    )
  }

  throw new ApiError(
    503,
    operation === "sale" ? "SALE_COMPLETION_FAILED" : "INVOICE_CREATION_FAILED",
    `We couldn't create this ${operation}. Please try again.`,
  )
}
