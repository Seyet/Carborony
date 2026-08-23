import { createInvoiceSchema } from "@/features/sales/pos/schemas"
import { createInvoice } from "@/features/sales/pos/server/create-invoice"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request, createInvoiceSchema, createInvoice)
}
