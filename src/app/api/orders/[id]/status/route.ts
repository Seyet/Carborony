import { z } from "zod"

import { updateOrderStatusSchema } from "@/features/orders/schemas"
import { updateOrderStatus } from "@/features/orders/server/update-order-status"
import { handleJsonPost, jsonError } from "@/lib/api/server"

const paramsSchema = z.object({ id: z.uuid() })

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const validation = paramsSchema.safeParse(await params)
  if (!validation.success) {
    return jsonError(404, "ORDER_NOT_FOUND", "This order could not be found.")
  }

  return handleJsonPost(request, updateOrderStatusSchema, (input) =>
    updateOrderStatus(validation.data.id, input),
  )
}

