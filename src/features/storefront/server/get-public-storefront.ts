import "server-only"

import { cache } from "react"

import { createClient } from "@/lib/supabase/server"
import type { Database, Json } from "@/types/database"
import { storefrontCopy } from "../copy"
import type { PublicStorefront, StorefrontDeliveryZone, StorefrontProduct, StorefrontSpecification, StorefrontVariant } from "../types"
import { publicStorageUrl } from "./media-url"

type JsonRecord = Record<string, Json | undefined>

function records(value: Json): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : []
}

function textValue(value: Json | undefined) {
  return typeof value === "string" ? value : ""
}

function numberValue(value: Json | undefined) {
  return typeof value === "number" ? value : Number(value ?? 0)
}

function mapVariants(value: Json): StorefrontVariant[] {
  return records(value).map((variant) => ({
    attributes: Object.fromEntries(Object.entries(
      variant.attributes && typeof variant.attributes === "object" && !Array.isArray(variant.attributes)
        ? variant.attributes
        : {},
    ).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
    id: textValue(variant.id),
    imageUrls: [],
    name: textValue(variant.name),
    sellingPrice: numberValue(variant.selling_price),
    sku: typeof variant.sku === "string" ? variant.sku : null,
    stockQuantity: numberValue(variant.stock_quantity),
  }))
}

function mapSpecifications(value: Json): StorefrontSpecification[] {
  return records([value]).flatMap((specifications) => Object.entries(specifications).flatMap(([name, specification]) => {
    if (!specification || Array.isArray(specification) || typeof specification !== "object") return []
    const value = specification.value
    const unit = specification.unit
    if (typeof value !== "string") return []
    return [{
      name,
      unit: unit === "cm" || unit === "in" || unit === "m" ? unit : "",
      value,
    }]
  }))
}

function mapMedia(value: Json) {
  return records(value)
    .filter((media) => media.media_kind === "image")
    .flatMap((media) => {
      const url = publicStorageUrl("product-media", textValue(media.storage_path))
      return url ? [{
        url,
        variantId: typeof media.variant_id === "string" ? media.variant_id : null,
      }] : []
    })
}

function mapDeliveryZones(value: Json): StorefrontDeliveryZone[] {
  return records(value).map((zone, index) => ({
    coverageDetails: typeof zone.coverage_details === "string" ? zone.coverage_details : null,
    deliveryFee: numberValue(zone.delivery_fee),
    id: textValue(zone.id),
    isActive: zone.is_active !== false,
    name: textValue(zone.name),
    position: typeof zone.position === "number" ? zone.position : index,
  }))
}

type ProductRow = Database["public"]["Functions"]["get_public_storefront_products"]["Returns"][number]

export function mapStorefrontProducts(products: ProductRow[]): StorefrontProduct[] {
  return products.map((product) => {
    const media = mapMedia(product.media)
    const variants = mapVariants(product.variants).map((variant) => ({
      ...variant,
      imageUrls: media.filter((item) => item.variantId === variant.id).map((item) => item.url),
    }))
    const productImageUrls = media.filter((item) => item.variantId === null).map((item) => item.url)

    return {
      availableStock: product.available_stock === null ? null : Number(product.available_stock),
      categoryId: product.category_id,
      categoryName: product.category_name,
      description: product.description,
      discountPrice: product.discount_price === null ? null : Number(product.discount_price),
      id: product.product_id,
      imageUrls: productImageUrls,
      isFeatured: product.is_featured,
      name: product.product_name,
      sellingPrice: Number(product.selling_price),
      specifications: mapSpecifications(product.specifications),
      trackInventory: product.track_inventory,
      variants,
    }
  })
}

// Settings and metadata do not need to fetch the catalogue. React cache shares
// this read between metadata and the page without sharing authenticated previews.
export const getPublicStorefrontInfo = cache(async (
  slug: string,
  preview = false,
): Promise<PublicStorefront | null> => {
  const supabase = await createClient()
  const storeResult = await supabase.rpc("get_public_storefront", {
    include_draft: preview,
    store_slug: slug,
  }, { get: true }).maybeSingle()
  if (storeResult.error) {
    const error = storeResult.error
    console.error("Public storefront query failed", { code: error.code, message: error.message.slice(0, 500) })
    if (["42883", "PGRST202", "PGRST204", "PGRST205"].includes(error.code ?? "")) return null
    throw new Error("Unable to load this storefront.", { cause: error })
  }
  const store = storeResult.data
  if (!store) return null

  return {
    onlinePaymentMode: null,
    businessId: store.business_id,
    businessName: store.business_name,
    currencyCode: store.currency_code,
    logoUrl: publicStorageUrl("business-logos", store.logo_path),
    products: [],
    settings: {
      announcement: store.announcement,
      bankTransferEnabled: store.bank_transfer_enabled,
      bankTransferInstructions: store.bank_transfer_instructions,
      contactEmail: store.contact_email,
      contactPhone: store.contact_phone,
      copy: storefrontCopy(store.storefront_copy, store.business_name, store.delivery_enabled),
      deliveryZones: mapDeliveryZones(store.delivery_zones),
      deliveryEnabled: store.delivery_enabled,
      heroBannerUrl: publicStorageUrl("storefront-media", store.hero_banner_path),
      heroSubtitle: store.hero_subtitle,
      heroTitle: store.hero_title,
      payOnDeliveryEnabled: store.pay_on_delivery_enabled,
      pickupAddress: store.pickup_address,
      pickupEnabled: store.pickup_enabled,
      primaryColor: store.primary_color,
      seoDescription: store.seo_description,
      seoTitle: store.seo_title,
      status: store.storefront_status as PublicStorefront["settings"]["status"],
    },
    slug: store.business_slug,
  }
})

// Product details remain a separate, single-product read.
export const getPublicStorefront = cache(async (
  slug: string,
  preview: boolean,
  productId: string,
): Promise<PublicStorefront | null> => {
  const supabase = await createClient()
  const [store, result] = await Promise.all([
    getPublicStorefrontInfo(slug, preview),
    supabase.rpc("get_public_storefront_products", {
      include_draft: preview,
      selected_product_id: productId,
      store_slug: slug,
    }, { get: true }),
  ])
  if (result.error) throw new Error("Unable to load this product.", { cause: result.error })
  return store ? { ...store, products: mapStorefrontProducts(result.data ?? []) } : null
})
