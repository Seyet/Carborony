import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getPublicStorefront } from "@/features/storefront/server/get-public-storefront"
import { StorefrontCart, StorefrontShell } from "@/features/storefront/storefront-shop"

export const metadata: Metadata = { robots: { index: false, follow: false }, title: "Cart" }

export default async function StoreCartPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string | string[] }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const rawPreview = query.preview
  const preview = (Array.isArray(rawPreview) ? rawPreview[0] : rawPreview) === "1"
  const store = await getPublicStorefront(slug, preview)
  if (!store) notFound()
  return <StorefrontShell preview={preview} store={store}><StorefrontCart store={store} /></StorefrontShell>
}
