import {
  storefrontBannerRequestSchema,
} from "@/features/storefront/schemas"
import { manageStorefrontBanner } from "@/features/storefront/server/manage-storefront-banner"
import type { StorefrontBannerResult, StorefrontBannerUpload } from "@/features/storefront/types"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost<typeof storefrontBannerRequestSchema, StorefrontBannerUpload | StorefrontBannerResult>(
    request,
    storefrontBannerRequestSchema,
    manageStorefrontBanner,
  )
}
