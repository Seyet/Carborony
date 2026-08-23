import { inventoryOperationSchema } from "@/features/inventory/schemas"
import { recordStockOperation } from "@/features/inventory/server/record-stock-operation"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request, inventoryOperationSchema, recordStockOperation)
}

