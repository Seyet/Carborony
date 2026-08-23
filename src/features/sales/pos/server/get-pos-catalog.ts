import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { createClient } from "@/lib/supabase/server"
import type { PosCatalog } from "../types"

export class PosSetupRequiredError extends Error {
  constructor() {
    super("The POS database migrations have not been applied.")
    this.name = "PosSetupRequiredError"
  }
}

export async function getPosCatalog(): Promise<PosCatalog> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()

  const [businessResult, productsResult, variantsResult, customersResult, levelsResult, invoiceSchemaResult, buyerSchemaResult] = await Promise.all([
    supabase.from("businesses").select("currency_code").eq("id", business.id).single(),
    supabase.from("products").select("id, name, selling_price, sku, track_inventory")
      .eq("business_id", business.id).eq("status", "active").order("name"),
    supabase.from("product_variants").select("id, product_id, name, sku, selling_price, cost_price, stock_quantity")
      .eq("business_id", business.id).eq("is_active", true).order("name"),
    supabase.from("customers").select("id, full_name, phone")
      .eq("business_id", business.id).order("full_name").limit(500),
    supabase.from("inventory_levels").select("product_id, quantity_on_hand, quantity_reserved")
      .eq("business_id", business.id),
    supabase.from("orders").select("document_type, payment_method").eq("business_id", business.id).limit(1),
    supabase.from("sales").select("buyer_name").eq("business_id", business.id).limit(1),
  ])

  const firstError = [businessResult, productsResult, variantsResult, customersResult, levelsResult, invoiceSchemaResult, buyerSchemaResult]
    .find((result) => result.error)?.error
  if (firstError) {
    if (firstError.code === "PGRST204" || firstError.code === "PGRST205") {
      throw new PosSetupRequiredError()
    }
    throw new Error("Unable to load the POS catalogue.", { cause: firstError })
  }

  const variantsByProduct = new Map<string, NonNullable<typeof variantsResult.data>>()
  for (const variant of variantsResult.data ?? []) {
    const variants = variantsByProduct.get(variant.product_id) ?? []
    variants.push(variant)
    variantsByProduct.set(variant.product_id, variants)
  }

  const stockByProduct = new Map<string, number>()
  for (const level of levelsResult.data ?? []) {
    stockByProduct.set(
      level.product_id,
      (stockByProduct.get(level.product_id) ?? 0)
        + Number(level.quantity_on_hand) - Number(level.quantity_reserved),
    )
  }

  return {
    currencyCode: businessResult.data?.currency_code ?? "NGN",
    customers: (customersResult.data ?? []).map((customer) => ({
      id: customer.id,
      name: customer.full_name,
      phone: customer.phone,
    })),
    products: (productsResult.data ?? []).map((product) => ({
      id: product.id,
      name: product.name,
      sellingPrice: Number(product.selling_price),
      sku: product.sku,
      stock: product.track_inventory ? (stockByProduct.get(product.id) ?? 0) : null,
      variants: (variantsByProduct.get(product.id) ?? []).map((variant) => ({
        costPrice: Number(variant.cost_price),
        id: variant.id,
        name: variant.name,
        sellingPrice: Number(variant.selling_price),
        sku: variant.sku,
        stock: product.track_inventory ? Number(variant.stock_quantity) : null,
      })),
    })),
  }
}
