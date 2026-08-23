import "server-only"

import { revalidatePath } from "next/cache"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { getCurrentUser } from "@/lib/auth/session"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { createClient } from "@/lib/supabase/server"
import type { UpdateOrderStatusInput } from "../schemas"
import type { UpdateOrderStatusData } from "../types"

const safeMessages = new Set([
  "A default inventory location is required.",
  "A paid order must be refunded instead of cancelled.",
  "Select a valid order status.",
  "Status notes must be 500 characters or fewer.",
  "This order could not be found.",
  "This order status transition is not allowed.",
  "There is not enough stock to complete this order.",
  "This operation would make stock negative.",
])

export async function updateOrderStatus(
  orderId: string,
  input: UpdateOrderStatusInput,
): Promise<JsonHandlerResult<UpdateOrderStatusData>> {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to update orders.")

  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("update_order_status", {
    requested_status: input.status,
    status_note: input.note,
    target_business_id: business.id,
    target_order_id: orderId,
  }).single()

  if (error) {
    console.error("Order status update failed", { code: error.code, details: error.details, message: error.message })
    if (safeMessages.has(error.message)) throw new ApiError(422, "ORDER_STATUS_INVALID", error.message)
    if (error.code === "42501") throw new ApiError(403, "ORDER_FORBIDDEN", "You do not have permission to update orders.")
    throw new ApiError(503, "ORDER_STATUS_FAILED", "We couldn't update this order. Please try again.")
  }
  if (!data) throw new ApiError(503, "ORDER_STATUS_FAILED", "We couldn't update this order. Please try again.")

  revalidatePath("/app/orders")
  revalidatePath(`/app/orders/${orderId}`)
  revalidatePath("/app/dashboard")
  revalidatePath("/app/customers")
  revalidatePath("/app/inventory")
  return {
    data: {
      currentStatus: data.current_status,
      orderId: data.order_id,
      previousStatus: data.previous_status,
    },
    message: `${data.order_number} moved to ${data.current_status}.`,
  }
}
