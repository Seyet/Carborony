import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { ApiError } from "@/lib/api/server"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database"
import type {
  CatalogueCategory,
  CatalogueResult,
  ProductEditorData,
  ProductEditorVariant,
} from "../types"

export const cataloguePageSize = 20

export class CatalogueSetupRequiredError extends Error {
  constructor() {
    super("The catalogue database migration has not been applied.")
    this.name = "CatalogueSetupRequiredError"
  }
}

type CatalogueFilters = {
  categoryId: string
  page: number
  query: string
  status: string
}

function mapCategories(rows: Array<{
  description: string | null
  id: string
  is_active: boolean
  name: string
  parent_id: string | null
  position: number
}>): CatalogueCategory[] {
  return rows.map((category) => ({
    description: category.description,
    id: category.id,
    isActive: category.is_active,
    name: category.name,
    parentId: category.parent_id,
    position: category.position,
  }))
}

function attributesToArray(value: Json): ProductEditorVariant["attributes"] {
  if (!value || Array.isArray(value) || typeof value !== "object") return []

  return Object.entries(value)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([name, attributeValue]) => ({ name, value: attributeValue }))
}

function publicMediaUrl(path: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return ""

  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/product-media/${path.split("/").map(encodeURIComponent).join("/")}`
}

export async function getCatalogue(filters: CatalogueFilters): Promise<CatalogueResult> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const [businessResult, categoryResult, productResult] = await Promise.all([
    supabase.from("businesses").select("currency_code").eq("id", business.id).single(),
    supabase.from("categories")
      .select("id, name, description, parent_id, position, is_active")
      .eq("business_id", business.id)
      .order("position")
      .order("name"),
    supabase.rpc("search_catalogue_products", {
      result_limit: cataloguePageSize,
      result_offset: (filters.page - 1) * cataloguePageSize,
      search_query: filters.query || undefined,
      selected_category_id: filters.categoryId || undefined,
      selected_status: filters.status || undefined,
      target_business_id: business.id,
    }),
  ])

  const firstError = [businessResult, categoryResult, productResult]
    .find((result) => result.error)?.error
  if (firstError) {
    if (["PGRST202", "PGRST204", "PGRST205"].includes(firstError.code)) {
      throw new CatalogueSetupRequiredError()
    }
    throw new Error("Unable to load the catalogue.", { cause: firstError })
  }

  const totalCount = Number(productResult.data?.[0]?.total_count ?? 0)

  return {
    categories: mapCategories(categoryResult.data ?? []),
    currencyCode: businessResult.data?.currency_code ?? "NGN",
    items: (productResult.data ?? []).map((product) => ({
      categoryId: product.category_id,
      categoryName: product.category_name,
      discountPrice: product.discount_price === null ? null : Number(product.discount_price),
      id: product.product_id,
      imageUrl: product.primary_media_path
        ? publicMediaUrl(product.primary_media_path)
        : null,
      lowStockThreshold: Number(product.low_stock_threshold),
      name: product.product_name,
      sellingPrice: Number(product.selling_price),
      sku: product.product_sku,
      status: product.product_status,
      stockQuantity: product.tracks_inventory ? Number(product.stock_quantity) : null,
      variantCount: Number(product.variant_count),
    })),
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(totalCount / cataloguePageSize)),
    totalCount,
  }
}

export async function getCatalogueOptions() {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const [businessResult, categoryResult] = await Promise.all([
    supabase.from("businesses").select("currency_code").eq("id", business.id).single(),
    supabase.from("categories")
      .select("id, name, description, parent_id, position, is_active")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("position")
      .order("name"),
  ])

  const firstError = businessResult.error ?? categoryResult.error
  if (firstError) {
    if (["PGRST204", "PGRST205"].includes(firstError.code)) {
      throw new CatalogueSetupRequiredError()
    }
    throw new Error("Unable to load catalogue options.", { cause: firstError })
  }

  return {
    categories: mapCategories(categoryResult.data ?? []),
    currencyCode: businessResult.data?.currency_code ?? "NGN",
  }
}

export async function getProductEditorData(productId: string): Promise<ProductEditorData> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const [productResult, variantsResult, levelsResult, mediaResult] = await Promise.all([
    supabase.from("products")
      .select("id, category_id, name, sku, description, status, selling_price, cost_price, discount_price, track_inventory, reorder_level, tags")
      .eq("business_id", business.id)
      .eq("id", productId)
      .maybeSingle(),
    supabase.from("product_variants")
      .select("id, name, sku, selling_price, cost_price, attributes, stock_quantity, low_stock_threshold, is_active")
      .eq("business_id", business.id)
      .eq("product_id", productId)
      .eq("is_active", true)
      .order("created_at"),
    supabase.from("inventory_levels")
      .select("quantity_on_hand")
      .eq("business_id", business.id)
      .eq("product_id", productId),
    supabase.from("product_media")
      .select("id, variant_id, media_kind, storage_path, file_name, position, is_primary")
      .eq("business_id", business.id)
      .eq("product_id", productId)
      .order("position")
      .order("created_at"),
  ])

  const firstError = [productResult, variantsResult, levelsResult, mediaResult]
    .find((result) => result.error)?.error
  if (firstError) {
    if (["PGRST204", "PGRST205"].includes(firstError.code)) {
      throw new CatalogueSetupRequiredError()
    }
    throw new Error("Unable to load this product.", { cause: firstError })
  }
  if (!productResult.data) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "This product could not be found.")
  }

  const variants: ProductEditorVariant[] = (variantsResult.data ?? []).map((variant) => ({
    attributes: attributesToArray(variant.attributes),
    costPrice: Number(variant.cost_price),
    id: variant.id,
    isActive: variant.is_active,
    lowStockThreshold: Number(variant.low_stock_threshold),
    name: variant.name,
    sellingPrice: Number(variant.selling_price),
    sku: variant.sku,
    stockQuantity: Number(variant.stock_quantity),
  }))
  const variantNames = new Map(variants.map((variant) => [variant.id, variant.name]))
  const product = productResult.data

  return {
    categoryId: product.category_id,
    costPrice: Number(product.cost_price),
    description: product.description,
    discountPrice: product.discount_price === null ? null : Number(product.discount_price),
    id: product.id,
    lowStockThreshold: Number(product.reorder_level),
    media: (mediaResult.data ?? []).map((media) => ({
      fileName: media.file_name,
      id: media.id,
      isPrimary: media.is_primary,
      kind: media.media_kind as "image" | "video",
      position: media.position,
      publicUrl: publicMediaUrl(media.storage_path),
      storagePath: media.storage_path,
      variantId: media.variant_id,
      variantName: media.variant_id ? variantNames.get(media.variant_id) ?? null : null,
    })),
    name: product.name,
    sellingPrice: Number(product.selling_price),
    sku: product.sku,
    status: product.status as ProductEditorData["status"],
    stockQuantity: (levelsResult.data ?? []).reduce(
      (total, level) => total + Number(level.quantity_on_hand),
      0,
    ),
    tags: product.tags,
    trackInventory: product.track_inventory,
    variants,
  }
}
