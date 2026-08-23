import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { createClient } from "@/lib/supabase/server"
import { PosSetupRequiredError } from "../../pos/server/get-pos-catalog"
import type { SalesHistoryItem } from "../types"

export const salesHistoryPageSize = 20

export type SalesHistoryResult = {
  items: SalesHistoryItem[]
  page: number
  pageCount: number
  totalCount: number
}

export async function getSalesHistory(
  page: number,
  searchQuery: string,
): Promise<SalesHistoryResult> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const [historyResult, buyerSchemaResult] = await Promise.all([
    supabase.rpc("search_sales_history", {
      result_limit: salesHistoryPageSize,
      result_offset: (page - 1) * salesHistoryPageSize,
      search_query: searchQuery || undefined,
      target_business_id: business.id,
    }),
    supabase.from("orders").select("buyer_name, payment_method").eq("business_id", business.id).limit(1),
  ])
  const { data, error } = historyResult
  const setupError = error ?? buyerSchemaResult.error

  if (setupError) {
    if (["PGRST202", "PGRST204", "PGRST205"].includes(setupError.code)) {
      throw new PosSetupRequiredError()
    }
    throw new Error("Unable to load sales history.", { cause: setupError })
  }

  const totalCount = Number(data?.[0]?.total_count ?? 0)
  return {
    items: (data ?? []).map((item) => ({
      currencyCode: item.currency_code,
      customerName: item.customer_name,
      documentNumber: item.document_number,
      id: item.document_id,
      issuedAt: item.issued_at,
      kind: item.document_kind as "invoice" | "sale",
      paymentMethod: item.payment_label,
      status: item.document_status,
      totalAmount: Number(item.total_amount),
    })),
    page,
    pageCount: Math.max(1, Math.ceil(totalCount / salesHistoryPageSize)),
    totalCount,
  }
}
