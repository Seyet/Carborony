import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import type { CreateInvoiceInput } from "../schemas"
import type { CreateInvoiceData } from "../types"
import { throwPosRpcError, toPosRpcItems } from "./pos-rpc"

export async function createInvoice(
  input: CreateInvoiceInput,
): Promise<JsonHandlerResult<CreateInvoiceData>> {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to create an invoice.")

  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_pos_invoice_with_buyer_and_payment", {
    invoice_discount_amount: input.discountAmount,
    items: toPosRpcItems(input.items),
    selected_customer_id: input.customerId,
    selected_payment_method: input.paymentMethod,
    target_business_id: business.id,
    transaction_buyer_name: input.buyerName,
    transaction_buyer_phone: input.buyerPhone,
  }).single()

  if (error) throwPosRpcError(error, "invoice")
  if (!data) {
    throw new ApiError(
      503,
      "INVOICE_CREATION_FAILED",
      "We couldn't create this invoice. Please try again.",
    )
  }

  return {
    data: {
      invoiceId: data.invoice_id,
      invoiceNumber: data.invoice_number,
      totalAmount: Number(data.total_amount),
    },
    message: `Invoice ${data.invoice_number} created successfully.`,
    status: 201,
  }
}
