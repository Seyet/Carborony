import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database"
import type { SaveProductData } from "../api-types"
import type { CatalogueProductInput } from "../schemas"

const safeDatabaseMessages = new Set([
  "Create a default inventory location before saving products.",
  "Enter valid product details.",
  "Enter valid product pricing and stock values.",
  "Product name must be between 2 and 160 characters.",
  "Select a valid category.",
  "Select a valid product status.",
  "This product could not be found.",
])

function toRpcProduct(input: CatalogueProductInput): Json {
  return {
    category_id: input.categoryId,
    cost_price: input.costPrice,
    description: input.description,
    discount_price: input.discountPrice,
    low_stock_threshold: input.lowStockThreshold,
    name: input.name,
    selling_price: input.sellingPrice,
    sku: input.sku,
    specifications: Object.fromEntries(input.specifications.map((specification) => [
      specification.name,
      { unit: specification.unit || null, value: specification.value },
    ])),
    status: input.status,
    stock_quantity: input.stockQuantity,
    tags: input.tags,
    track_inventory: input.trackInventory,
    variants: input.variants.map((variant) => ({
      attributes: Object.fromEntries(
        variant.attributes.map((attribute) => [attribute.name, attribute.value]),
      ),
      cost_price: variant.costPrice,
      id: variant.id,
      is_active: variant.isActive,
      low_stock_threshold: variant.lowStockThreshold,
      name: variant.name,
      selling_price: variant.sellingPrice,
      sku: variant.sku,
      stock_quantity: variant.stockQuantity,
    })),
  }
}

export async function saveCatalogueProduct(
  input: CatalogueProductInput,
  productId: string | null,
): Promise<JsonHandlerResult<SaveProductData>> {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to manage products.")

  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("save_catalogue_product", {
    catalogue_product: toRpcProduct(input),
    target_business_id: business.id,
    target_product_id: productId,
  }).single()

  if (error) {
    console.error("Catalogue product save failed", {
      code: error.code,
      details: error.details,
      message: error.message,
    })

    if (safeDatabaseMessages.has(error.message)) {
      throw new ApiError(422, "PRODUCT_INVALID", error.message)
    }
    if (error.code === "23505") {
      throw new ApiError(409, "PRODUCT_SKU_EXISTS", "A product or variant already uses this SKU.")
    }
    if (error.code === "42501") {
      throw new ApiError(403, "PRODUCT_FORBIDDEN", "You do not have permission to manage products.")
    }
    throw new ApiError(503, "PRODUCT_SAVE_FAILED", "We couldn't save this product. Please try again.")
  }
  if (!data) {
    throw new ApiError(503, "PRODUCT_SAVE_FAILED", "We couldn't save this product. Please try again.")
  }

  return {
    data: {
      productId: data.product_id,
      redirectTo: `/app/catalogue/${data.product_id}`,
    },
    message: data.was_created ? "Product created successfully." : "Product updated successfully.",
    status: data.was_created ? 201 : 200,
  }
}
