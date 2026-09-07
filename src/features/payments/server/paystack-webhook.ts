import "server-only"

import { paymentReferenceSchema } from "../checkout-schemas"
import { validPaystackSignature } from "./online-payment-provider"
import { reconcileStorefrontPayment } from "./storefront-payments"

export async function handlePaystackWebhook(request: Request) {
  // Validate the signature over the exact bytes, before decoding JSON. Bound chunked requests too.
  const reader = request.body?.getReader()
  if (!reader) return new Response(null, { status: 400 })
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > 256 * 1024) { await reader.cancel(); return new Response(null, { status: 413 }) }
      chunks.push(value)
    }
    const body = Buffer.concat(chunks)
    if (!validPaystackSignature(body, request.headers.get("x-paystack-signature"))) return new Response(null, { status: 401 })
    let event: { event?: string; data?: { reference?: string } }
    try { event = JSON.parse(body.toString("utf8")) } catch { return new Response(null, { status: 400 }) }
    if (event?.event !== "charge.success") return new Response(null, { status: 200 })
    const reference = paymentReferenceSchema.safeParse(event.data?.reference)
    // Other products may use this integration; acknowledge their events without touching orders.
    if (!reference.success) return new Response(null, { status: 200 })
    const result = await reconcileStorefrontPayment(reference.data)
    if (result && !["paid", "review"].includes(result.status)) return new Response(null, { status: 503 })
    return new Response(null, { status: 200 })
  } catch {
    // No acknowledgement until verification and database commit succeed. Paystack will retry.
    console.error("Paystack webhook could not be processed")
    return new Response(null, { status: 503 })
  }
}
