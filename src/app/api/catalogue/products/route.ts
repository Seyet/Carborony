import { catalogueProductSchema } from "@/features/catalogue/schemas"
import { saveCatalogueProduct } from "@/features/catalogue/server/save-product"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request, catalogueProductSchema, (input) =>
    saveCatalogueProduct(input, null),
  )
}
