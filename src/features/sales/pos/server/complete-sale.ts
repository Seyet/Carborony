import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import type { CompleteSaleInput } from "../schemas"
import type { CompleteSaleData } from "../types"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { throwPosRpcError, toPosRpcItems } from "./pos-rpc"

export async function completeSale(
  input: CompleteSaleInput,
): Promise<JsonHandlerResult<CompleteSaleData>> {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to complete this sale.")

  const business = await getCurrentBusiness()
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("complete_pos_sale_with_buyer", {
    items: toPosRpcItems(input.items),
    sale_discount_amount: input.discountAmount,
    selected_customer_id: input.customerId,
    selected_payment_method: input.paymentMethod,
    target_business_id: business.id,
    transaction_buyer_name: input.buyerName,
    transaction_buyer_phone: input.buyerPhone,
  }).single()

  if (error) throwPosRpcError(error, "sale")

  if (!data) throw new ApiError(503, "SALE_COMPLETION_FAILED", "We couldn't complete this sale. Please try again.")

  return {
    data: {
      saleId: data.sale_id,
      saleNumber: data.sale_number,
      totalAmount: Number(data.total_amount),
    },
    message: `Sale ${data.sale_number} completed successfully.`,
    status: 201,
  }
}
