import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, CheckCircle2, Search, ShoppingBag, Sparkles, Truck } from "lucide-react"

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
  const featuredCount = products.filter((product) => product.isFeatured).length

  return <StorefrontShell preview={preview} store={store}>
    <main>
      <section
        className="relative isolate overflow-hidden border-b"
        style={{ background: `radial-gradient(circle at 85% 10%, color-mix(in srgb, ${store.settings.primaryColor} 22%, transparent), transparent 34%), linear-gradient(135deg, color-mix(in srgb, ${store.settings.primaryColor} 9%, var(--background)), var(--background) 65%)` }}
      >
        <div className="pointer-events-none absolute -top-28 -left-28 size-72 rounded-full border border-foreground/5" />
        <div className="pointer-events-none absolute -top-16 -left-16 size-48 rounded-full border border-foreground/5" />
        <div className="mx-auto grid min-h-[590px] max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,0.75fr)] lg:items-center lg:px-8 lg:py-24">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/75 px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur">
              <Sparkles aria-hidden="true" className="size-3.5" style={{ color: store.settings.primaryColor }} />
              {store.settings.copy.heroEyebrow}
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.045em] text-balance sm:text-6xl lg:text-7xl">{store.settings.heroTitle}</h1>
            {store.settings.heroSubtitle ? <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">{store.settings.heroSubtitle}</p> : null}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button className="h-11 rounded-full px-5 shadow-lg" nativeButton={false} render={<a href="#products" />} size="lg" style={{ backgroundColor: store.settings.primaryColor }}><ShoppingBag aria-hidden="true" />{store.settings.copy.heroCtaLabel}<ArrowRight aria-hidden="true" /></Button>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><CheckCircle2 aria-hidden="true" className="size-4 text-emerald-600" />Simple, secure ordering</span>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-foreground/10 pt-6 text-sm">
              <span><strong className="block text-foreground">{store.products.length}</strong><span className="text-xs text-muted-foreground">Products to explore</span></span>
              <span className="border-l pl-6"><strong className="block text-foreground">Direct</strong><span className="text-xs text-muted-foreground">From {store.businessName}</span></span>
              <span className="border-l pl-6"><strong className="block text-foreground">Easy</strong><span className="text-xs text-muted-foreground">Checkout in minutes</span></span>
            </div>
          </div>

          {store.settings.heroBannerUrl ? (
            <div className="relative mx-auto w-full max-w-xl lg:mx-0">
              <div className="absolute -inset-3 rotate-2 rounded-[2rem] opacity-20" style={{ backgroundColor: store.settings.primaryColor }} />
              <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-muted shadow-2xl ring-1 ring-foreground/10 sm:aspect-[5/4] lg:aspect-[4/5]">
                <Image alt={`${store.businessName} collection`} fill className="object-cover transition duration-700 hover:scale-[1.02]" priority sizes="(max-width: 1024px) 100vw, 42vw" src={store.settings.heroBannerUrl} unoptimized />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6 pt-20 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">{store.settings.copy.heroEyebrow}</p>
                  <p className="mt-1 text-xl font-semibold">{store.settings.heroTitle}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative hidden aspect-[4/5] overflow-hidden rounded-[2rem] bg-foreground text-background shadow-2xl lg:flex lg:items-center lg:justify-center">
              <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 30% 20%, ${store.settings.primaryColor}, transparent 35%), radial-gradient(circle at 80% 80%, ${store.settings.primaryColor}, transparent 40%)` }} />
              <div className="relative text-center"><span className="mx-auto flex size-24 items-center justify-center rounded-full bg-background/10"><ShoppingBag aria-hidden="true" className="size-10" /></span><p className="mt-6 text-xl font-semibold">Discover something special</p><p className="mt-2 text-sm text-background/60">Browse our latest collection below</p></div>
            </div>
          )}
        </div>
      </section>

      <section className="border-b bg-card">
        <div className="mx-auto grid max-w-7xl divide-y px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 py-5 sm:px-5 sm:first:pl-0"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700"><CheckCircle2 aria-hidden="true" className="size-5" /></span><span><strong className="block text-sm">{store.settings.copy.trustOneTitle}</strong><span className="text-xs text-muted-foreground">{store.settings.copy.trustOneDescription}</span></span></div>
          <div className="flex items-center gap-3 py-5 sm:px-5"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-700"><Truck aria-hidden="true" className="size-5" /></span><span><strong className="block text-sm">{store.settings.copy.trustTwoTitle}</strong><span className="text-xs text-muted-foreground">{store.settings.copy.trustTwoDescription}</span></span></div>
          <div className="flex items-center gap-3 py-5 sm:px-5 sm:last:pr-0"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-700"><ShoppingBag aria-hidden="true" className="size-5" /></span><span><strong className="block text-sm">{store.settings.copy.trustThreeTitle}</strong><span className="text-xs text-muted-foreground">{store.settings.copy.trustThreeDescription}</span></span></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8" id="products">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: store.settings.primaryColor }}><span className="h-px w-7" style={{ backgroundColor: store.settings.primaryColor }} />{store.settings.copy.catalogueEyebrow}</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{store.settings.copy.catalogueTitle}</h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{store.settings.copy.catalogueDescription}</p><p className="mt-2 text-xs font-medium text-muted-foreground">{products.length} {products.length === 1 ? "product" : "products"}{featuredCount ? ` · ${featuredCount} featured` : ""}</p></div><form action={`/store/${store.slug}`} className="relative w-full lg:max-w-md"><Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-12 rounded-full bg-card pl-11 pr-4 shadow-sm" defaultValue={first(queryParams.query)} name="query" placeholder="What are you looking for?" type="search" />{preview ? <input name="preview" type="hidden" value="1" /> : null}</form></div>
        {categories.length ? <div className="mt-7 flex gap-2 overflow-x-auto pb-2"><Link className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition ${!category ? "text-white shadow-sm" : "bg-card hover:bg-muted"}`} href={`/store/${store.slug}?${query ? `query=${encodeURIComponent(query)}${previewParam}` : preview ? "preview=1" : ""}`} style={!category ? { backgroundColor: store.settings.primaryColor, borderColor: store.settings.primaryColor } : undefined}>All products</Link>{categories.map(([id, name]) => <Link className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition ${category === id ? "text-white shadow-sm" : "bg-card hover:bg-muted"}`} href={`/store/${store.slug}?category=${id}${query ? `&query=${encodeURIComponent(query)}` : ""}${previewParam}`} key={id} style={category === id ? { backgroundColor: store.settings.primaryColor, borderColor: store.settings.primaryColor } : undefined}>{name}</Link>)}</div> : null}
        {products.length ? <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 xl:grid-cols-4">{products.map((product) => <ProductCard key={product.id} preview={preview} product={product} store={store} />)}</div> : <div className="mt-10 rounded-[2rem] border border-dashed bg-muted/20 px-6 py-20 text-center"><span className="mx-auto flex size-16 items-center justify-center rounded-full bg-background shadow-sm"><ShoppingBag aria-hidden="true" className="size-7 text-muted-foreground" /></span><h3 className="mt-5 text-lg font-semibold">No matching products</h3><p className="mt-2 text-sm text-muted-foreground">Try another search or browse all categories.</p><Button className="mt-5 rounded-full" nativeButton={false} render={<Link href={`/store/${store.slug}${preview ? "?preview=1" : ""}`} />} variant="outline">View all products</Button></div>}
      </section>
    </main>
  </StorefrontShell>
}
