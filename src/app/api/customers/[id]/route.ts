import { z } from "zod"

import { saveCustomerSchema } from "@/features/customers/schemas"
import { saveCustomer } from "@/features/customers/server/customers"
import { jsonError, handleJsonPost } from "@/lib/api/server"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const validation = z.uuid().safeParse((await context.params).id)
  if (!validation.success) {
    return jsonError(400, "INVALID_CUSTOMER", "The requested customer is invalid.")
  }
  return handleJsonPost(
    request,
    saveCustomerSchema,
    (input) => saveCustomer(input, validation.data),
  )
}
