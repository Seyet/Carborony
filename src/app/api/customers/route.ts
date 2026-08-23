import { saveCustomerSchema } from "@/features/customers/schemas"
import { saveCustomer } from "@/features/customers/server/customers"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request, saveCustomerSchema, (input) => saveCustomer(input, null))
}
