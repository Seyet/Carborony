import "server-only"

import { revalidatePath } from "next/cache"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database"
import { storefrontCopyJson } from "../copy"
import type { StorefrontSettingsInput } from "../schemas"

type SaveStorefrontResult = { productCount: number; slug: string; status: string }

const safeMessages = new Set([
  "Check the storefront configuration and try again.",
  "Check the storefront wording and try again.",
  "Check the delivery zones and prices.",
  "Add at least one delivery zone and price.",
  "Delivery zone names must be unique.",
  "Featured products must also be published.",
  "Only active products can be published online.",
  "Publish at least one active product before launching the store.",
  "Select a valid storefront status.",
])

export async function saveStorefront(input: StorefrontSettingsInput): Promise<JsonHandlerResult<SaveStorefrontResult>> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const configuration: Json = {
    announcement: input.announcement,
    bank_transfer_enabled: input.bankTransferEnabled,
    bank_transfer_instructions: input.bankTransferInstructions,
    contact_email: input.contactEmail,
    contact_phone: input.contactPhone,
    storefront_copy: storefrontCopyJson(input.copy),
    delivery_zones: input.deliveryZones.map((zone, position) => ({
      coverage_details: zone.coverageDetails,
      delivery_fee: zone.deliveryFee,
      id: zone.id,
      is_active: zone.isActive,
      name: zone.name,
      position,
    })),
    delivery_enabled: input.deliveryEnabled,
    hero_subtitle: input.heroSubtitle,
    hero_title: input.heroTitle,
    pay_on_delivery_enabled: input.payOnDeliveryEnabled,
    pickup_address: input.pickupAddress,
    pickup_enabled: input.pickupEnabled,
    primary_color: input.primaryColor,
    seo_description: input.seoDescription,
    seo_title: input.seoTitle,
  }
  const { data, error } = await supabase.rpc("save_storefront_with_copy", {
    featured_product_ids: input.featuredProductIds,
    published_product_ids: input.publishedProductIds,
    requested_status: input.requestedStatus,
    storefront_configuration: configuration,
    target_business_id: business.id,
  }).single()

  if (error) {
    if (error.code === "42501") throw new ApiError(403, "STOREFRONT_FORBIDDEN", "You do not have permission to manage this storefront.")
    if (safeMessages.has(error.message)) throw new ApiError(422, "STOREFRONT_INVALID", error.message)
    if (["42883", "PGRST202", "PGRST204", "PGRST205"].includes(error.code)) throw new ApiError(503, "STOREFRONT_SETUP_REQUIRED", "Apply the storefront database migration first.")
    throw new ApiError(503, "STOREFRONT_SAVE_FAILED", "We couldn't save the storefront. Please try again.")
  }
  if (!data) throw new ApiError(503, "STOREFRONT_SAVE_FAILED", "We couldn't save the storefront. Please try again.")

  revalidatePath("/app/website")
  revalidatePath(`/store/${data.store_slug}`)
  return {
    data: { productCount: data.published_product_count, slug: data.store_slug, status: data.storefront_status },
    message: data.storefront_status === "published" ? "Your storefront is live." : "Storefront changes saved.",
  }
}
