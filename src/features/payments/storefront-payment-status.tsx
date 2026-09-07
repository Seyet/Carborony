"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { postJson } from "@/lib/api/client"
import type { ApiResponse } from "@/types/api"
import type { PaymentStatus } from "./server/storefront-payments"

export function StorefrontPaymentStatus({ reference, slug }: { reference: string; slug: string }) {
  const [payment, setPayment] = useState<PaymentStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(true)

  const applyResult = useCallback((result: ApiResponse<PaymentStatus>) => {
    setPending(false)
    if (!result.ok) { setError(result.error.message); return }
    setPayment(result.data)
    if (result.data.status === "paid" || result.data.status === "review") {
      try {
        const key = `carborony-pending-payment:${slug}`
        const saved = JSON.parse(sessionStorage.getItem(key) ?? "null")
        if (saved?.reference === reference) {
          const cartKey = `carborony-storefront-cart:${slug}`
          if (localStorage.getItem(cartKey) === saved.cart) localStorage.removeItem(cartKey)
          sessionStorage.removeItem(key)
          sessionStorage.removeItem(`carborony-checkout:${slug}`)
        }
      } catch { /* A storage restriction must not hide the payment result. */ }
    }
  }, [reference, slug])

  useEffect(() => {
    const controller = new AbortController()
    void postJson<PaymentStatus>("/api/storefront/payment", { reference, slug }, {
      loading: false,
      signal: controller.signal,
    })
      .then(result => { if (!controller.signal.aborted) applyResult(result) })
    return () => controller.abort()
  }, [applyResult, reference, slug])

  async function check() {
    setPending(true)
    setError(null)
    applyResult(await postJson<PaymentStatus>("/api/storefront/payment", { reference, slug }))
  }

  const paid = payment?.status === "paid"
  const review = payment?.status === "review"
  return <main className="storefront-payment-page min-h-screen bg-muted/20 px-4 py-16 sm:py-24">
    <div className="storefront-status-card mx-auto max-w-lg rounded-3xl border bg-card p-8 text-center shadow-sm">
      {pending ? <LoaderCircle className="mx-auto size-12 animate-spin text-muted-foreground" aria-hidden="true" />
        : paid ? <CheckCircle2 className="mx-auto size-12 text-emerald-600" aria-hidden="true" /> : <ShieldCheck className="mx-auto size-12 text-muted-foreground" aria-hidden="true" />}
      <h1 className="mt-5 text-2xl font-semibold">{pending ? "Checking your payment" : paid ? "Payment received" : review ? "Payment received — order needs review" : "Your payment"}</h1>
      <div aria-live="polite">
        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : <p className="mt-4 text-sm text-muted-foreground">{pending ? "Please wait while we confirm your payment."
          : paid ? "Thank you. The store can now process your order."
          : review ? "Please contact the store about this order before paying again."
          : payment?.status === "failed" ? "Payment was not completed. You can return to Paystack to try again."
          : "Payment has not been confirmed yet. If you already paid, check again shortly. Do not start another order."}</p>}
      </div>
      {payment ? <div className="mt-6 rounded-2xl bg-muted p-4"><p className="font-medium">{payment.orderNumber}</p><p className="mt-2 text-2xl font-semibold">{new Intl.NumberFormat("en", { style: "currency", currency: payment.currency }).format(payment.amount)}</p>{payment.mode === "test" ? <p className="mt-2 text-sm font-medium text-amber-700">Test payment — no real money collected</p> : null}</div> : null}
      {!paid && !review ? <div className="mt-6 grid gap-3">
        {payment?.resumeUrl ? <a className="rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground" href={payment.resumeUrl}>Continue to Paystack</a> : null}
        <Button disabled={pending} onClick={() => void check()} variant="outline">{pending ? "Checking…" : "Check payment status"}</Button>
      </div> : null}
      <Link className="mt-6 inline-block text-sm underline underline-offset-4" href={`/store/${slug}`}>Return to store</Link>
    </div>
  </main>
}
