import { z } from "zod"

import { markInvoicePaidSchema } from "@/features/sales/invoices/schemas"
import { markInvoicePaid } from "@/features/sales/invoices/server/mark-invoice-paid"
import { handleJsonPost, jsonError } from "@/lib/api/server"

const paramsSchema = z.object({ id: z.uuid() })

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const validation = paramsSchema.safeParse(await context.params)
  if (!validation.success) {
    return jsonError(400, "INVALID_INVOICE", "The requested invoice is invalid.")
  }

  return handleJsonPost(
    request,
    markInvoicePaidSchema,
    (input) => markInvoicePaid(validation.data.id, input),
  )
}
