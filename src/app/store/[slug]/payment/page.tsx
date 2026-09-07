import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { paymentCallbackReference, paymentStatusSchema } from "@/features/payments/checkout-schemas"
import { StorefrontPaymentStatus } from "@/features/payments/storefront-payment-status"

export const metadata: Metadata = { title: "Payment status", robots: { index: false, follow: false }, referrer: "no-referrer" }

export default async function PaymentPage({ params, searchParams }: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ reference?: string | string[]; trxref?: string | string[] }>
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const reference = paymentCallbackReference(query.reference, query.trxref)
  const parsed = paymentStatusSchema.safeParse({ slug, reference })
  if (!parsed.success) notFound()
  return <StorefrontPaymentStatus key={parsed.data.reference} {...parsed.data} />
}
