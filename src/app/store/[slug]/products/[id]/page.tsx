import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, Package } from "lucide-react"

import { getPublicStorefront } from "@/features/storefront/server/get-public-storefront"
import { ProductPurchase, StorefrontShell } from "@/features/storefront/storefront-shop"

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
  const money = new Intl.NumberFormat("en", { currency: store.currencyCode, currencyDisplay: "narrowSymbol", style: "currency" })
  const price = product.variants[0]?.sellingPrice ?? product.discountPrice ?? product.sellingPrice

  return <StorefrontShell preview={preview} store={store}><main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><Link className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" href={`/store/${store.slug}${preview ? "?preview=1" : ""}`}><ChevronLeft aria-hidden="true" className="size-4" />Back to shop</Link><div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_440px]"><div className="grid gap-3 sm:grid-cols-2">{product.imageUrls.length ? product.imageUrls.map((url, index) => <div className={`relative overflow-hidden rounded-2xl bg-muted ${index === 0 ? "aspect-square sm:col-span-2" : "aspect-square"}`} key={url}><Image alt={`${product.name}${index ? ` image ${index + 1}` : ""}`} fill className="object-cover" priority={index === 0} sizes={index === 0 ? "(max-width: 1024px) 100vw, 60vw" : "(max-width: 640px) 100vw, 30vw"} src={url} unoptimized /></div>) : <div className="relative aspect-square rounded-2xl bg-muted sm:col-span-2"><Package aria-hidden="true" className="absolute inset-0 m-auto size-20 text-muted-foreground/30" /></div>}</div><section className="lg:sticky lg:top-24 lg:self-start"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{product.categoryName ?? "Shop"}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{product.name}</h1><div className="mt-4 flex items-center gap-3"><strong className="text-2xl">{money.format(price)}</strong>{product.discountPrice !== null && !product.variants.length ? <span className="text-sm text-muted-foreground line-through">{money.format(product.sellingPrice)}</span> : null}</div>{product.description ? <p className="mt-6 whitespace-pre-wrap leading-7 text-muted-foreground">{product.description}</p> : null}<div className="mt-8"><ProductPurchase product={product} /></div><div className="mt-8 border-t pt-5 text-xs text-muted-foreground"><p>Prices and availability are verified at checkout.</p>{store.settings.deliveryEnabled ? <p className="mt-1">Delivery pricing is based on the zone selected at checkout.</p> : null}{store.settings.pickupEnabled ? <p className="mt-1">Pickup available from {store.settings.pickupAddress}.</p> : null}</div></section></div></main></StorefrontShell>
}
