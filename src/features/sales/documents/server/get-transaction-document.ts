import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { ApiError } from "@/lib/api/server"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import type {
  TransactionDocumentData,
  TransactionDocumentKind,
} from "../types"

type CustomerRecord = {
  email: string | null
  full_name: string
  phone: string | null
}

function resolveBuyer(
  buyerName: string | null,
  buyerPhone: string | null,
  customer: CustomerRecord | null,
) {
  const name = buyerName ?? customer?.full_name ?? null
  const phone = buyerPhone ?? customer?.phone ?? null

  if (!name && !phone && !customer?.email) return null
  return {
    email: customer?.email ?? null,
    name: name ?? "Walk-in customer",
    phone,
  }
}

export async function getTransactionDocument(
  kind: TransactionDocumentKind,
  id: string,
): Promise<TransactionDocumentData> {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to download this document.")

  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const businessResult = await supabase.from("businesses")
    .select("name, address, phone, email, website_url, currency_code")
    .eq("id", business.id)
    .single()

  if (businessResult.error || !businessResult.data) {
    throw new ApiError(503, "DOCUMENT_UNAVAILABLE", "We couldn't prepare this document. Please try again.")
  }

  if (kind === "sale") {
    const saleResult = await supabase.from("sales")
      .select("id, customer_id, buyer_name, buyer_phone, sale_number, sold_at, channel, status, payment_method, currency_code, subtotal_amount, discount_amount, tax_amount, total_amount")
      .eq("business_id", business.id)
      .eq("id", id)
      .maybeSingle()

    if (saleResult.error) {
      throw new ApiError(503, "DOCUMENT_UNAVAILABLE", "We couldn't prepare this receipt. Please try again.")
    }
    if (!saleResult.data) throw new ApiError(404, "SALE_NOT_FOUND", "This sale could not be found.")

    const [itemsResult, customerResult] = await Promise.all([
      supabase.from("sale_items")
        .select("item_source, product_name, variant_name, sku, quantity, unit_price, discount_amount, line_total")
        .eq("business_id", business.id)
        .eq("sale_id", saleResult.data.id)
        .order("created_at"),
      saleResult.data.customer_id
        ? supabase.from("customers").select("full_name, email, phone")
            .eq("business_id", business.id).eq("id", saleResult.data.customer_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (itemsResult.error || customerResult.error) {
      throw new ApiError(503, "DOCUMENT_UNAVAILABLE", "We couldn't prepare this receipt. Please try again.")
    }

    return {
      business: {
        address: businessResult.data.address,
        email: businessResult.data.email,
        name: businessResult.data.name,
        phone: businessResult.data.phone,
        websiteUrl: businessResult.data.website_url,
      },
      channel: saleResult.data.channel,
      currencyCode: saleResult.data.currency_code,
      customer: resolveBuyer(
        saleResult.data.buyer_name,
        saleResult.data.buyer_phone,
        customerResult.data,
      ),
      discountAmount: Number(saleResult.data.discount_amount),
      deliveryAddress: null,
      id: saleResult.data.id,
      issuedAt: saleResult.data.sold_at,
      items: (itemsResult.data ?? []).map((item) => ({
        discountAmount: Number(item.discount_amount),
        itemSource: item.item_source as "catalogue" | "external",
        lineTotal: Number(item.line_total),
        name: item.product_name,
        quantity: Number(item.quantity),
        sku: item.sku,
        unitPrice: Number(item.unit_price),
        variantName: item.variant_name,
      })),
      kind,
      notes: null,
      number: saleResult.data.sale_number,
      paymentMethod: saleResult.data.payment_method.replaceAll("_", " "),
      paymentStatus: saleResult.data.status === "completed" ? "paid" : saleResult.data.status,
      shippingAmount: 0,
      status: saleResult.data.status,
      subtotalAmount: Number(saleResult.data.subtotal_amount),
      taxAmount: Number(saleResult.data.tax_amount),
      totalAmount: Number(saleResult.data.total_amount),
    }
  }

  const isOrder = kind === "order"
  const orderResult = await supabase.from("orders")
    .select("id, customer_id, buyer_name, buyer_phone, delivery_address, order_number, placed_at, channel, status, payment_method, payment_status, currency_code, subtotal_amount, discount_amount, tax_amount, shipping_amount, total_amount, notes")
    .eq("business_id", business.id)
    .eq("document_type", isOrder ? "order" : "invoice")
    .eq("id", id)
    .maybeSingle()

  if (orderResult.error) {
    throw new ApiError(503, "DOCUMENT_UNAVAILABLE", `We couldn't prepare this ${isOrder ? "order receipt" : "invoice"}. Please try again.`)
  }
  if (!orderResult.data) {
    throw new ApiError(
      404,
      isOrder ? "ORDER_NOT_FOUND" : "INVOICE_NOT_FOUND",
      `This ${isOrder ? "order" : "invoice"} could not be found.`,
    )
  }

  const [itemsResult, customerResult] = await Promise.all([
    supabase.from("order_items")
      .select("item_source, product_name, variant_name, sku, quantity, unit_price, discount_amount, line_total")
      .eq("business_id", business.id)
      .eq("order_id", orderResult.data.id)
      .order("created_at"),
    orderResult.data.customer_id
      ? supabase.from("customers").select("full_name, email, phone")
          .eq("business_id", business.id).eq("id", orderResult.data.customer_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (itemsResult.error || customerResult.error) {
    throw new ApiError(503, "DOCUMENT_UNAVAILABLE", `We couldn't prepare this ${isOrder ? "order receipt" : "invoice"}. Please try again.`)
  }

  return {
    business: {
      address: businessResult.data.address,
      email: businessResult.data.email,
      name: businessResult.data.name,
      phone: businessResult.data.phone,
      websiteUrl: businessResult.data.website_url,
    },
    channel: orderResult.data.channel,
    currencyCode: orderResult.data.currency_code,
    customer: resolveBuyer(
      orderResult.data.buyer_name,
      orderResult.data.buyer_phone,
      customerResult.data,
    ),
    discountAmount: Number(orderResult.data.discount_amount),
    deliveryAddress: orderResult.data.delivery_address,
    id: orderResult.data.id,
    issuedAt: orderResult.data.placed_at,
    items: (itemsResult.data ?? []).map((item) => ({
      discountAmount: Number(item.discount_amount),
      itemSource: item.item_source as "catalogue" | "external",
      lineTotal: Number(item.line_total),
      name: item.product_name,
      quantity: Number(item.quantity),
      sku: item.sku,
      unitPrice: Number(item.unit_price),
      variantName: item.variant_name,
    })),
    kind,
    notes: orderResult.data.notes,
    number: orderResult.data.order_number,
    paymentMethod: orderResult.data.payment_method?.replaceAll("_", " ") ?? "not specified",
    paymentStatus: orderResult.data.payment_status,
    shippingAmount: Number(orderResult.data.shipping_amount),
    status: orderResult.data.status,
    subtotalAmount: Number(orderResult.data.subtotal_amount),
    taxAmount: Number(orderResult.data.tax_amount),
    totalAmount: Number(orderResult.data.total_amount),
  }
}
