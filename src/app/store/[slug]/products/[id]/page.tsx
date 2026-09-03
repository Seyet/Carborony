import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { getPublicStorefront } from "@/features/storefront/server/get-public-storefront"
import { StorefrontProductView, StorefrontShell } from "@/features/storefront/storefront-shop"

type ProductPageProps = {
  params: Promise<{ id: string; slug: string }>
  searchParams: Promise<{ preview?: string | string[] }>
}

function first(value?: string | string[]) { return Array.isArray(value) ? value[0] : value }

export async function generateMetadata({ params, searchParams }: ProductPageProps): Promise<Metadata> {
  const [{ id, slug }, query] = await Promise.all([params, searchParams])
  const preview = first(query.preview) === "1"
  const store = await getPublicStorefront(slug, preview, id)
  const product = store?.products[0]
  if (!store || !product) return { title: "Product unavailable" }
  return { description: product.description, robots: preview ? { index: false, follow: false } : undefined, title: `${product.name} · ${store.businessName}` }
}

export default async function StoreProductPage({ params, searchParams }: ProductPageProps) {
  const [{ id, slug }, query] = await Promise.all([params, searchParams])
  const preview = first(query.preview) === "1"
  const store = await getPublicStorefront(slug, preview, id)
  const product = store?.products[0]
  if (!store || !product) notFound()

  return <StorefrontShell preview={preview} store={store}><main className="bg-muted/15"><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"><Link className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-2 text-sm font-medium text-muted-foreground shadow-xs transition hover:-translate-x-0.5 hover:text-foreground" href={`/store/${store.slug}${preview ? "?preview=1" : ""}`}><ChevronLeft aria-hidden="true" className="size-4" />Back to shop</Link><StorefrontProductView product={product} store={store} /></div></main></StorefrontShell>
}
