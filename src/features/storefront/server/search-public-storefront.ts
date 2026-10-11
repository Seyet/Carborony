import "server-only"

import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"
import { mapStorefrontProducts } from "./get-public-storefront"

export const storefrontPageSize = 24

export function parseStorefrontFilters(query: { query?: string; category?: string; page?: string }) {
  const requestedPage = Number(query.page)
  return {
    query: (query.query ?? "").trim().slice(0, 100),
    category: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.category ?? "")
      ? query.category! : "",
    page: Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 10_000
      ? requestedPage : 1,
  }
}

export async function searchPublicStorefront(
  slug: string,
  preview: boolean,
  filters: ReturnType<typeof parseStorefrontFilters>,
) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("search_public_storefront_products", {
    store_slug: slug,
    include_draft: preview,
    search_query: filters.query,
    selected_category_id: filters.category || undefined,
    result_limit: storefrontPageSize,
    result_offset: (filters.page - 1) * storefrontPageSize,
  }, { get: true }).single()
  if (error || !data) throw new Error("Unable to load storefront products.", { cause: error })
  type ProductRow = Database["public"]["Functions"]["get_public_storefront_products"]["Returns"][number]
  return {
    products: mapStorefrontProducts(data.products as unknown as ProductRow[]),
    categories: data.categories as { id: string; name: string }[],
    totalCount: Number(data.total_count),
    storeCount: Number(data.store_count),
    featuredCount: Number(data.featured_count),
    pageCount: Math.max(1, Math.ceil(Number(data.total_count) / storefrontPageSize)),
  }
}
