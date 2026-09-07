import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"
import { ApiError } from "@/lib/api/server"
import { paymentEnvironment, paystackRequest } from "./paystack"

export function checkoutOrigin() {
  let url: URL
  try { url = new URL(process.env.PAYMENTS_APP_URL ?? "") } catch {
    throw new ApiError(503, "PAYMENTS_UNAVAILABLE", "Online payment is unavailable. Please try again later.")
  }
  if (url.protocol !== "https:" && !(paymentEnvironment().mode === "test"
    && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new ApiError(503, "PAYMENTS_UNAVAILABLE", "Online payment is unavailable. Please try again later.")
  }
  return url.origin
}

export function isPaystackCheckoutUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname === "checkout.paystack.com"
      && !url.username && !url.password && !url.port
  } catch { return false }
}

export async function initializeOnlinePayment(input: {
  reference: string; email: string; amount: number; subaccount: string
  commissionPercent: number; slug: string; orderId: string; businessId: string
}) {
  const callback = new URL(`/store/${encodeURIComponent(input.slug)}/payment`, checkoutOrigin())
  const transactionCharge = Number((BigInt(input.amount)
    * BigInt(Math.round(input.commissionPercent * 100)) + BigInt(5000)) / BigInt(10000))
  const data = z.object({ reference: z.string(), authorization_url: z.string().refine(isPaystackCheckoutUrl) })
    .parse(await paystackRequest("/transaction/initialize", {
      reference: input.reference, email: input.email, amount: String(input.amount), currency: "NGN",
      subaccount: input.subaccount,
      // Freeze the owner-approved platform share for this order; provider fees are borne by the platform.
      ...(transactionCharge > 0 ? { transaction_charge: transactionCharge } : {}), bearer: "account",
      callback_url: callback.toString(),
      metadata: JSON.stringify({ order_id: input.orderId, business_id: input.businessId, subaccount_code: input.subaccount }),
    }))
  if (data.reference !== input.reference) throw new ApiError(502, "PAYMENT_MISMATCH", "Payment initialization could not be confirmed.")
  return data.authorization_url
}

export const verifiedTransactionSchema = z.object({
  id: z.number().int().positive().safe(), reference: z.string(), status: z.string(),
  amount: z.number().int().nonnegative().safe(), currency: z.string(), domain: z.enum(["test", "live"]),
  metadata: z.unknown(),
})

export async function verifyOnlinePayment(reference: string) {
  return verifiedTransactionSchema.parse(await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`))
}

export function validPaystackSignature(body: Buffer, signature: string | null) {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false
  const expected = createHmac("sha512", paymentEnvironment().secret).update(body).digest()
  return timingSafeEqual(expected, Buffer.from(signature, "hex"))
}
