import "server-only"

import { createHash } from "node:crypto"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { StorefrontCheckoutInput } from "@/features/storefront/schemas"
import type { StorefrontCheckoutResult } from "@/features/storefront/types"
import { paymentEnvironment, PaystackRequestError } from "./paystack"
import { checkoutOrigin, initializeOnlinePayment, isPaystackCheckoutUrl, verifyOnlinePayment } from "./online-payment-provider"

export type PaymentStatus = { status: "pending" | "failed" | "paid" | "review"; reference: string; orderNumber: string; amount: number; currency: string; mode: "test" | "live"; resumeUrl: string | null }

function databaseFailure(error: { code: string }) {
  console.error("Storefront payment database request failed", { code: error.code })
  return new ApiError(503, "PAYMENT_SAVE_FAILED", "We couldn't confirm this payment. Please check again shortly.")
}

export async function onlinePaymentMode(businessId: string): Promise<"test" | "live" | null> {
  try {
    const { mode } = paymentEnvironment()
    checkoutOrigin()
    const { data, error } = await createAdminClient().from("business_payment_accounts")
      .select("id").eq("business_id", businessId).eq("provider_mode", mode)
      .eq("status", "connected").eq("provider_active", true).maybeSingle()
    if (error) { console.error("Online payment availability failed", { code: error.code }); return null }
    return data ? mode : null
  } catch { return null }
}

export async function createOnlineStorefrontOrder(input: StorefrontCheckoutInput): Promise<JsonHandlerResult<StorefrontCheckoutResult>> {
  const { mode } = paymentEnvironment()
  checkoutOrigin()
  const admin = createAdminClient()
  const { data: payment, error } = await admin.rpc("create_storefront_online_order", {
    checkout_buyer_email: input.buyerEmail, checkout_buyer_name: input.buyerName,
    checkout_buyer_phone: input.buyerPhone, checkout_delivery_address: input.deliveryAddress ?? "",
    checkout_delivery_method: input.deliveryMethod, checkout_delivery_zone_id: input.deliveryZoneId,
    checkout_idempotency_key: input.idempotencyKey,
    checkout_items: input.items.map(item => ({ product_id: item.productId, variant_id: item.variantId, quantity: item.quantity })),
    checkout_notes: input.notes ?? "", checkout_payment_method: "online", store_slug: input.slug,
    checkout_mode: mode, checkout_fingerprint: createHash("sha256").update(JSON.stringify(input)).digest("hex"),
  }).single()
  if (error) {
    if (error.code === "22023") throw new ApiError(422, "CHECKOUT_INVALID", "Check your cart, delivery details and payment availability. If you changed a pending order, return to your cart and try again.")
    throw databaseFailure(error)
  }
  if (!payment) throw new ApiError(503, "CHECKOUT_FAILED", "We couldn't prepare your payment. Please try again.")

  let paymentUrl = `/store/${encodeURIComponent(input.slug)}/payment?reference=${encodeURIComponent(payment.reference)}`
  if (payment.status === "ready" && payment.authorization_url && isPaystackCheckoutUrl(payment.authorization_url)) {
    paymentUrl = payment.authorization_url
  } else if (payment.status === "created") {
    // Claim before calling Paystack. Concurrent or uncertain requests reuse this reference.
    const { data: claim, error: claimError } = await admin.from("storefront_payments")
      .update({ status: "initializing" }).eq("reference", payment.reference).eq("status", "created").select("reference").maybeSingle()
    if (claimError) throw databaseFailure(claimError)
    if (claim) {
      try {
        const url = await initializeOnlinePayment({
          reference: payment.reference, email: payment.buyer_email, amount: Number(payment.amount_minor),
          subaccount: payment.subaccount_code, commissionPercent: Number(payment.commission_percent),
          slug: payment.store_slug, orderId: payment.order_id, businessId: payment.business_id,
        })
        const { error: saveError } = await admin.from("storefront_payments").update({ authorization_url: url, status: "ready" })
          .eq("reference", payment.reference).eq("status", "initializing")
        if (saveError) throw databaseFailure(saveError)
        paymentUrl = url
      } catch (cause) {
        // Only an explicit rejection permits another initialize call. Lost responses stay recoverable.
        if (cause instanceof PaystackRequestError && cause.definitiveRejection) {
          const { error: resetError } = await admin.from("storefront_payments").update({ status: "created" })
            .eq("reference", payment.reference).eq("status", "initializing")
          if (resetError) throw databaseFailure(resetError)
          throw new ApiError(422, "PAYMENT_REJECTED", "Paystack couldn't start this payment. Please try again or contact the store.")
        }
        console.error("Online payment initialization needs verification", { reference: payment.reference })
      }
    }
  }
  return { data: { orderId: payment.order_id, orderNumber: payment.order_number, totalAmount: Number(payment.amount_minor) / 100,
    currencyCode: payment.currency_code, paymentMethod: "online", bankTransferInstructions: null,
    paymentUrl, paymentReference: payment.reference }, status: 201 }
}

export async function reconcileStorefrontPayment(reference: string, slug?: string): Promise<PaymentStatus | null> {
  const admin = createAdminClient()
  const { data: payment, error } = await admin.from("storefront_payments").select("*").eq("reference", reference).maybeSingle()
  if (error) throw databaseFailure(error)
  if (!payment || (slug !== undefined && payment.store_slug !== slug)) return null
  if (payment.provider_mode !== paymentEnvironment().mode) throw new ApiError(503, "PAYMENT_MODE_UNAVAILABLE", "This payment cannot be checked right now. Please contact the store.")
  const result = (status: PaymentStatus["status"]): PaymentStatus => ({
    status, reference, orderNumber: payment.order_number, amount: Number(payment.amount_minor) / 100,
    currency: payment.currency_code, mode: payment.provider_mode as "test" | "live",
    resumeUrl: ["pending", "failed"].includes(status) && payment.authorization_url && isPaystackCheckoutUrl(payment.authorization_url) ? payment.authorization_url : null,
  })
  if (payment.status === "paid") return result(payment.status)
  const transaction = await verifyOnlinePayment(reference)
  const metadata = transaction.metadata as Record<string, unknown> | null
  if (transaction.reference !== reference || transaction.amount !== Number(payment.amount_minor)
    || transaction.currency !== payment.currency_code || transaction.domain !== payment.provider_mode
    || !metadata || metadata.order_id !== payment.order_id || metadata.business_id !== payment.business_id
    || metadata.subaccount_code !== payment.subaccount_code) {
    console.error("Online payment verification mismatch", { reference })
    throw new ApiError(409, "PAYMENT_MISMATCH", "The payment details need review. Please contact the store.")
  }
  if (transaction.status !== "success") return result(["failed", "abandoned", "reversed"].includes(transaction.status) ? "failed" : "pending")
  const { data: status, error: settleError } = await admin.rpc("settle_storefront_payment", {
    payment_reference: reference, verified_amount: transaction.amount, verified_currency: transaction.currency,
    verified_mode: transaction.domain, verified_transaction_id: String(transaction.id),
  })
  if (settleError) throw databaseFailure(settleError)
  if (status !== "paid" && status !== "review") throw new ApiError(503, "PAYMENT_PENDING", "Payment confirmation is still pending. Please check again.")
  return result(status)
}
