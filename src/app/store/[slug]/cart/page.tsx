import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { onlinePaymentMode } from "@/features/payments/server/storefront-payments"
import { getPublicStorefrontInfo } from "@/features/storefront/server/get-public-storefront"
import { StorefrontCart, StorefrontShell } from "@/features/storefront/storefront-shop"

export const metadata: Metadata = { robots: { index: false, follow: false }, title: "Cart" }

export default async function StoreCartPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string | string[] }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const rawPreview = query.preview
  const preview = (Array.isArray(rawPreview) ? rawPreview[0] : rawPreview) === "1"
  const store = await getPublicStorefrontInfo(slug, preview)
  if (!store) notFound()
  const checkoutStore = {
    ...store,
    onlinePaymentMode: store.currencyCode === "NGN" && store.settings.status === "published"
      ? await onlinePaymentMode(store.businessId) : null,
  }
  return <StorefrontShell preview={preview} store={checkoutStore}><StorefrontCart store={checkoutStore} /></StorefrontShell>
}
