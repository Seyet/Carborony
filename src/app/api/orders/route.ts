import { createManualOrderSchema } from "@/features/orders/schemas"
import { createManualOrder } from "@/features/orders/server/create-order"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request, createManualOrderSchema, createManualOrder)
}

