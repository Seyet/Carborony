import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import type { MarkInvoicePaidInput } from "../schemas"
import type { MarkInvoicePaidData } from "../types"

const safeDatabaseMessages = new Set([
  "A cancelled invoice cannot be marked as paid.",
  "A refunded invoice cannot be marked as paid.",
  "A default inventory location is required.",
  "Select a valid payment method.",
  "There is not enough stock to mark this invoice as paid.",
  "This invoice could not be found.",
])

export async function markInvoicePaid(
  invoiceId: string,
  input: MarkInvoicePaidInput,
): Promise<JsonHandlerResult<MarkInvoicePaidData>> {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to update this invoice.")

  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("mark_pos_invoice_paid_with_method", {
    selected_payment_method: input.paymentMethod,
    target_business_id: business.id,
    target_invoice_id: invoiceId,
  }).single()

  if (error) {
    console.error("Invoice payment update failed", {
      code: error.code,
      details: error.details,
      message: error.message,
    })

    if (safeDatabaseMessages.has(error.message)) {
      throw new ApiError(422, "INVOICE_PAYMENT_INVALID", error.message)
    }
    if (error.code === "42501") {
      throw new ApiError(403, "INVOICE_PAYMENT_FORBIDDEN", "You do not have permission to update this invoice.")
    }
    throw new ApiError(503, "INVOICE_PAYMENT_FAILED", "We couldn't mark this invoice as paid. Please try again.")
  }

  if (!data) {
    throw new ApiError(503, "INVOICE_PAYMENT_FAILED", "We couldn't mark this invoice as paid. Please try again.")
  }

  return {
    data: {
      documentStatus: data.document_status,
      invoiceId: data.invoice_id,
      invoiceNumber: data.invoice_number,
      paymentMethod: data.payment_method,
      paymentStatus: data.payment_status,
    },
    message: `Invoice ${data.invoice_number} marked as paid.`,
  }
}
