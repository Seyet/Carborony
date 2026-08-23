import { completeSaleSchema } from "@/features/sales/pos/schemas"
import { completeSale } from "@/features/sales/pos/server/complete-sale"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request, completeSaleSchema, completeSale)
}
