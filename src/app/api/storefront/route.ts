import { storefrontSettingsSchema } from "@/features/storefront/schemas"
import { saveStorefront } from "@/features/storefront/server/save-storefront"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request, storefrontSettingsSchema, saveStorefront, { maxBytes: 64 * 1024 })
}
