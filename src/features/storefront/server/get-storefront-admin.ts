import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { createClient } from "@/lib/supabase/server"
import { storefrontCopy } from "../copy"
import type { StorefrontAdminData } from "../types"
import { publicStorageUrl } from "./media-url"

export class StorefrontSetupRequiredError extends Error {
  constructor() {
    super("The storefront database migration has not been applied.")
    this.name = "StorefrontSetupRequiredError"
  }
}

function isSetupError(code: string) {
  return ["42P01", "PGRST202", "PGRST204", "PGRST205"].includes(code)
}

export async function getStorefrontAdminData(): Promise<StorefrontAdminData> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const [businessResult, storefrontResult, productsResult, categoriesResult, selectionsResult, mediaResult, zonesResult] = await Promise.all([
    supabase.from("businesses").select("currency_code, slug").eq("id", business.id).single(),
    supabase.from("storefronts").select("*").eq("business_id", business.id).single(),
    supabase.from("products").select("id, name, selling_price, status, category_id")
      .eq("business_id", business.id).order("name"),
    supabase.from("categories").select("id, name").eq("business_id", business.id),
    supabase.from("storefront_products").select("product_id, is_visible, is_featured")
      .eq("business_id", business.id),
    supabase.from("product_media").select("product_id, storage_path, is_primary, position")
      .eq("business_id", business.id).eq("media_kind", "image")
      .order("is_primary", { ascending: false }).order("position"),
    supabase.from("storefront_delivery_zones").select("id, name, coverage_details, delivery_fee, is_active, position")
      .eq("business_id", business.id).order("position").order("name"),
  ])

  const firstError = [businessResult, storefrontResult, productsResult, categoriesResult, selectionsResult, mediaResult, zonesResult]
    .find((result) => result.error)?.error
  if (firstError) {
    if (isSetupError(firstError.code)) throw new StorefrontSetupRequiredError()
    throw new Error("Unable to load the storefront workspace.", { cause: firstError })
  }

  const storefront = storefrontResult.data
  if (!storefront) throw new StorefrontSetupRequiredError()
  const selections = new Map((selectionsResult.data ?? []).map((item) => [item.product_id, item]))
  const categories = new Map((categoriesResult.data ?? []).map((category) => [category.id, category.name]))
  const images = new Map<string, string>()
  for (const media of mediaResult.data ?? []) {
    if (!images.has(media.product_id)) images.set(media.product_id, media.storage_path)
  }

  return {
    businessName: business.name,
    canManage: business.permissions.includes("settings.manage"),
    currencyCode: businessResult.data?.currency_code ?? "NGN",
    products: (productsResult.data ?? []).map((product) => ({
      categoryName: product.category_id ? categories.get(product.category_id) ?? null : null,
      id: product.id,
      imageUrl: publicStorageUrl("product-media", images.get(product.id) ?? null),
      isFeatured: selections.get(product.id)?.is_featured ?? false,
      isPublished: selections.get(product.id)?.is_visible ?? false,
      name: product.name,
      sellingPrice: Number(product.selling_price),
      status: product.status,
    })),
    settings: {
      announcement: storefront.announcement,
      bankTransferEnabled: storefront.bank_transfer_enabled,
      bankTransferInstructions: storefront.bank_transfer_instructions,
      contactEmail: storefront.contact_email,
      contactPhone: storefront.contact_phone,
      copy: storefrontCopy(storefront.storefront_copy, business.name, storefront.delivery_enabled),
      deliveryZones: (zonesResult.data ?? []).map((zone) => ({
        coverageDetails: zone.coverage_details,
        deliveryFee: Number(zone.delivery_fee),
        id: zone.id,
        isActive: zone.is_active,
        name: zone.name,
        position: zone.position,
      })),
      deliveryEnabled: storefront.delivery_enabled,
      heroBannerUrl: publicStorageUrl("storefront-media", storefront.hero_banner_path),
      heroSubtitle: storefront.hero_subtitle,
      heroTitle: storefront.hero_title,
      payOnDeliveryEnabled: storefront.pay_on_delivery_enabled,
      pickupAddress: storefront.pickup_address,
      pickupEnabled: storefront.pickup_enabled,
      primaryColor: storefront.primary_color,
      seoDescription: storefront.seo_description,
      seoTitle: storefront.seo_title,
      status: storefront.status as StorefrontAdminData["settings"]["status"],
    },
    slug: businessResult.data?.slug ?? "",
  }
}
