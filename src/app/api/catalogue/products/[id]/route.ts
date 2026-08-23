import { z } from "zod"

import { catalogueProductSchema } from "@/features/catalogue/schemas"
import { saveCatalogueProduct } from "@/features/catalogue/server/save-product"
import { handleJsonPost, jsonError } from "@/lib/api/server"

const paramsSchema = z.object({ id: z.uuid() })

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const validation = paramsSchema.safeParse(await context.params)
  if (!validation.success) {
    return jsonError(400, "INVALID_PRODUCT", "The requested product is invalid.")
  }

  return handleJsonPost(request, catalogueProductSchema, (input) =>
    saveCatalogueProduct(input, validation.data.id),
  )
}
