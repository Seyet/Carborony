import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Search, ShoppingBag } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getPublicStorefront } from "@/features/storefront/server/get-public-storefront"
import { ProductCard, StorefrontShell } from "@/features/storefront/storefront-shop"

type StorePageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ category?: string | string[]; preview?: string | string[]; query?: string | string[] }>
}

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

export async function generateMetadata({ params, searchParams }: StorePageProps): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const store = await getPublicStorefront(slug, first(query.preview) === "1")
  if (!store) return { title: "Store unavailable" }
  return {
    description: store.settings.seoDescription ?? store.settings.heroSubtitle,
    robots: first(query.preview) === "1" ? { index: false, follow: false } : undefined,
    title: store.settings.seoTitle ?? store.businessName,
  }
}

export default async function StorePage({ params, searchParams }: StorePageProps) {
  const [{ slug }, queryParams] = await Promise.all([params, searchParams])
  const preview = first(queryParams.preview) === "1"
  const store = await getPublicStorefront(slug, preview)
  if (!store) notFound()
  const query = (first(queryParams.query) ?? "").trim().slice(0, 100).toLowerCase()
  const category = (first(queryParams.category) ?? "").trim()
  const categories = [...new Map(store.products.filter((product) => product.categoryId).map((product) => [product.categoryId, product.categoryName])).entries()]
  const products = store.products.filter((product) =>
    (!query || `${product.name} ${product.description ?? ""}`.toLowerCase().includes(query))
    && (!category || product.categoryId === category),
  ).sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured))
  const previewParam = preview ? "&preview=1" : ""

  return <StorefrontShell preview={preview} store={store}>
    <main>
      <section className="border-b bg-muted/30"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1fr_0.7fr] lg:items-center lg:px-8"><div><p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: store.settings.primaryColor }}>Welcome to {store.businessName}</p><h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">{store.settings.heroTitle}</h1>{store.settings.heroSubtitle ? <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{store.settings.heroSubtitle}</p> : null}<Button className="mt-7" nativeButton={false} render={<a href="#products" />} size="lg" style={{ backgroundColor: store.settings.primaryColor }}><ShoppingBag aria-hidden="true" />Shop products</Button></div>{store.settings.heroBannerUrl ? <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border bg-background shadow-sm"><Image alt={`${store.businessName} banner`} fill className="object-cover" priority sizes="(max-width: 1024px) 100vw, 40vw" src={store.settings.heroBannerUrl} unoptimized /></div> : <div className="hidden aspect-[4/3] items-center justify-center rounded-3xl border bg-background shadow-sm lg:flex"><ShoppingBag aria-hidden="true" className="size-24 opacity-10" style={{ color: store.settings.primaryColor }} /></div>}</div></section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8" id="products">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Our catalogue</p><h2 className="mt-1 text-2xl font-semibold">Shop products</h2></div><form action={`/store/${store.slug}`} className="relative w-full lg:max-w-sm"><Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-11 pl-9" defaultValue={first(queryParams.query)} name="query" placeholder="Search the store" type="search" />{preview ? <input name="preview" type="hidden" value="1" /> : null}</form></div>
        {categories.length ? <div className="mt-5 flex flex-wrap gap-2"><Link className={`rounded-full border px-3 py-1.5 text-xs ${!category ? "text-white" : "hover:bg-muted"}`} href={`/store/${store.slug}?${query ? `query=${encodeURIComponent(query)}${previewParam}` : preview ? "preview=1" : ""}`} style={!category ? { backgroundColor: store.settings.primaryColor } : undefined}>All products</Link>{categories.map(([id, name]) => <Link className={`rounded-full border px-3 py-1.5 text-xs ${category === id ? "text-white" : "hover:bg-muted"}`} href={`/store/${store.slug}?category=${id}${query ? `&query=${encodeURIComponent(query)}` : ""}${previewParam}`} key={id} style={category === id ? { backgroundColor: store.settings.primaryColor } : undefined}>{name}</Link>)}</div> : null}
        {products.length ? <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">{products.map((product) => <ProductCard key={product.id} preview={preview} product={product} store={store} />)}</div> : <div className="mt-8 rounded-2xl border border-dashed px-6 py-16 text-center"><ShoppingBag aria-hidden="true" className="mx-auto size-8 text-muted-foreground" /><h3 className="mt-4 font-semibold">No matching products</h3><p className="mt-1 text-sm text-muted-foreground">Try another search or category.</p></div>}
      </section>
    </main>
  </StorefrontShell>
}
