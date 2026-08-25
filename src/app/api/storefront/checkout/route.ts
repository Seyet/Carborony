import { storefrontCheckoutSchema } from "@/features/storefront/schemas"
import { createStorefrontOrder } from "@/features/storefront/server/create-storefront-order"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request, storefrontCheckoutSchema, createStorefrontOrder, { maxBytes: 32 * 1024 })
}
