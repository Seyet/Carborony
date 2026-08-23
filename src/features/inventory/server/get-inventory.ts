import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database"
import type { InventoryPageData, InventoryProduct, InventoryView } from "../types"

export const inventoryPageSize = 20

export class InventorySetupRequiredError extends Error {
  constructor() {
    super("The inventory database migration has not been applied.")
    this.name = "InventorySetupRequiredError"
  }
}

type InventoryFilters = {
  movementType: string
  page: number
  query: string
  stockStatus: string
  view: InventoryView
}

function publicMediaUrl(path: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return null

  const encodedPath = path.split("/").map(encodeURIComponent).join("/")
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/product-media/${encodedPath}`
}

function mapVariants(value: Json): InventoryProduct["variants"] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (!item || Array.isArray(item) || typeof item !== "object") return []
    if (typeof item.id !== "string" || typeof item.name !== "string") return []
    if (item.sku !== null && typeof item.sku !== "string") return []
    if (typeof item.stock_quantity !== "number") return []

    return [{
      id: item.id,
      name: item.name,
      sku: item.sku,
      stockQuantity: item.stock_quantity,
    }]
  })
}

export async function getInventory(filters: InventoryFilters): Promise<InventoryPageData> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const commonPagination = {
    result_limit: inventoryPageSize,
    result_offset: (filters.page - 1) * inventoryPageSize,
    search_query: filters.query || undefined,
    target_business_id: business.id,
  }
  const listRequest = filters.view === "history"
    ? supabase.rpc("search_inventory_movements", {
        ...commonPagination,
        selected_movement_type: filters.movementType || undefined,
      })
    : supabase.rpc("search_inventory_products", {
        ...commonPagination,
        selected_stock_status: filters.stockStatus || undefined,
      })

  const [businessResult, metricsResult, listResult] = await Promise.all([
    supabase.from("businesses")
      .select("currency_code, timezone")
      .eq("id", business.id)
      .single(),
    supabase.rpc("get_inventory_metrics", { target_business_id: business.id }).single(),
    listRequest,
  ])

  const firstError = [businessResult, metricsResult, listResult]
    .find((result) => result.error)?.error
  if (firstError) {
    if (["PGRST202", "PGRST204", "PGRST205"].includes(firstError.code)) {
      throw new InventorySetupRequiredError()
    }
    throw new Error("Unable to load inventory.", { cause: firstError })
  }

  const metrics = metricsResult.data
  const rows = listResult.data ?? []
  const totalCount = Number(rows[0]?.total_count ?? 0)
  const products = filters.view === "stock"
    ? (rows as Array<{
        category_name: string | null
        cost_price: number
        inventory_value: number
        low_stock_threshold: number
        primary_media_path: string | null
        product_id: string
        product_name: string
        product_sku: string | null
        product_status: string
        stock_quantity: number
        tracks_inventory: boolean
        variants: Json
      }>).map((product) => ({
        categoryName: product.category_name,
        costPrice: Number(product.cost_price),
        id: product.product_id,
        imageUrl: product.primary_media_path ? publicMediaUrl(product.primary_media_path) : null,
        inventoryValue: Number(product.inventory_value),
        lowStockThreshold: Number(product.low_stock_threshold),
        name: product.product_name,
        sku: product.product_sku,
        status: product.product_status,
        stockQuantity: Number(product.stock_quantity),
        trackInventory: product.tracks_inventory,
        variants: mapVariants(product.variants),
      }))
    : []
  const movements = filters.view === "history"
    ? (rows as Array<{
        created_by_name: string
        location_name: string
        movement_id: string
        movement_type: string
        note: string | null
        occurred_at: string
        product_id: string
        product_name: string
        product_sku: string | null
        quantity_delta: number
        unit_cost: number | null
        variant_name: string | null
      }>).map((movement) => ({
        createdByName: movement.created_by_name,
        id: movement.movement_id,
        locationName: movement.location_name,
        movementType: movement.movement_type,
        note: movement.note,
        occurredAt: movement.occurred_at,
        productId: movement.product_id,
        productName: movement.product_name,
        productSku: movement.product_sku,
        quantityDelta: Number(movement.quantity_delta),
        unitCost: movement.unit_cost === null ? null : Number(movement.unit_cost),
        variantName: movement.variant_name,
      }))
    : []

  return {
    currencyCode: businessResult.data?.currency_code ?? "NGN",
    items: products,
    metrics: {
      inventoryValue: Number(metrics?.inventory_value ?? 0),
      lowStockCount: Number(metrics?.low_stock_count ?? 0),
      outOfStockCount: Number(metrics?.out_of_stock_count ?? 0),
      totalProducts: Number(metrics?.total_products ?? 0),
      totalUnits: Number(metrics?.total_units ?? 0),
    },
    movements,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(totalCount / inventoryPageSize)),
    timezone: businessResult.data?.timezone ?? "Africa/Lagos",
    totalCount,
  }
}
