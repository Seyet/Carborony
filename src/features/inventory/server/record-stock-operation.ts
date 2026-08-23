import "server-only"

import { revalidatePath } from "next/cache"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { getCurrentUser } from "@/lib/auth/session"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { createClient } from "@/lib/supabase/server"
import type { InventoryOperationData } from "../api-types"
import type { InventoryOperationInput } from "../schemas"

const safeDatabaseMessages = new Set([
  "A default inventory location is required.",
  "Enter a valid stock quantity.",
  "Inventory tracking is disabled for this product.",
  "Select a valid stock operation.",
  "Select the product variant to update.",
  "Stock notes must be 500 characters or fewer.",
  "Stock quantity must be greater than zero.",
  "The new stock level is unchanged.",
  "This operation would make stock negative.",
  "This product could not be found.",
  "This product variant could not be found.",
])

export async function recordStockOperation(
  input: InventoryOperationInput,
): Promise<JsonHandlerResult<InventoryOperationData>> {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to manage inventory.")

  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("record_inventory_operation", {
    operation_note: input.note,
    operation_type: input.operation,
    quantity_value: input.quantity,
    target_business_id: business.id,
    target_product_id: input.productId,
    target_variant_id: input.variantId,
  }).single()

  if (error) {
    console.error("Inventory operation failed", {
      code: error.code,
      details: error.details,
      message: error.message,
    })
    if (safeDatabaseMessages.has(error.message)) {
      throw new ApiError(422, "INVENTORY_OPERATION_INVALID", error.message)
    }
    if (error.code === "42501") {
      throw new ApiError(403, "INVENTORY_FORBIDDEN", "You do not have permission to manage inventory.")
    }
    if (error.code === "23514") {
      throw new ApiError(422, "INSUFFICIENT_STOCK", "This operation would make stock negative. Refresh inventory and check the available quantity.")
    }
    if (["PGRST202", "PGRST204", "PGRST205"].includes(error.code)) {
      throw new ApiError(503, "INVENTORY_SETUP_REQUIRED", "Apply the inventory database migration first.")
    }
    throw new ApiError(503, "INVENTORY_OPERATION_FAILED", "We couldn't update stock. Please try again.")
  }
  if (!data) {
    throw new ApiError(503, "INVENTORY_OPERATION_FAILED", "We couldn't update stock. Please try again.")
  }

  revalidatePath("/app/inventory")
  revalidatePath("/app/catalogue")
  revalidatePath(`/app/catalogue/${data.product_id}`)
  revalidatePath("/app/dashboard")
  revalidatePath("/app/sales")

  return {
    data: {
      currentStock: Number(data.current_stock),
      movementId: data.movement_id,
      productId: data.product_id,
      quantityDelta: Number(data.quantity_delta),
    },
    message: `${data.product_name} stock updated successfully.`,
  }
}
