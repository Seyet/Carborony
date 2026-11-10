import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowRight, CheckCircle2, Search, ShoppingBag, Sparkles, Truck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getPublicStorefrontInfo } from "@/features/storefront/server/get-public-storefront"
import { parseStorefrontFilters, searchPublicStorefront } from "@/features/storefront/server/search-public-storefront"
import { ProductCard, StorefrontShell } from "@/features/storefront/storefront-shop"

type StorePageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string | string[]; category?: string | string[]; preview?: string | string[]; query?: string | string[] }>
}

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

export async function generateMetadata({ params, searchParams }: StorePageProps): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const store = await getPublicStorefrontInfo(slug, first(query.preview) === "1")
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
  const filters = parseStorefrontFilters({
    query: first(queryParams.query),
    category: first(queryParams.category),
    page: first(queryParams.page),
  })
  const [store, catalogue] = await Promise.all([
    getPublicStorefrontInfo(slug, preview),
    searchPublicStorefront(slug, preview, filters),
  ])
  if (!store) notFound()
  const { query, category, page } = filters
  const { products, categories, totalCount, storeCount, featuredCount, pageCount } = catalogue
  function pageHref(nextPage: number, nextCategory = category) {
    const params = new URLSearchParams()
    if (query) params.set("query", query)
    if (nextCategory) params.set("category", nextCategory)
    if (preview) params.set("preview", "1")
    if (nextPage > 1) params.set("page", String(nextPage))
    return `/store/${slug}${params.size ? `?${params}` : ""}#products`
  }
  const heroImage = store.settings.heroBannerUrl ?? products.find(product => product.imageUrls.length)?.imageUrls[0]
  if (page > pageCount) redirect(pageHref(pageCount))

  return <StorefrontShell preview={preview} store={store}>
    <main>
      <section className="storefront-hero relative isolate overflow-hidden border-b">
        <div aria-hidden="true" className="storefront-hero-halo" />
        <div aria-hidden="true" className="storefront-orbit pointer-events-none absolute -top-24 -left-24 size-80 rounded-full border border-foreground/5" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pt-10 pb-12 sm:gap-14 sm:px-6 sm:py-16 lg:min-h-[680px] lg:grid-cols-[1fr_0.95fr] lg:items-center lg:gap-16 lg:px-8 lg:py-20">
          <div className="storefront-hero-copy relative z-10 min-w-0">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-foreground/10 bg-background/75 px-3.5 py-2 text-xs font-medium shadow-xs backdrop-blur">
              <Sparkles aria-hidden="true" className="size-3.5 shrink-0" style={{ color: store.settings.primaryColor }} />
              <span className="truncate">{store.settings.copy.heroEyebrow}</span>
            </div>
            <h1 className="mt-6 max-w-3xl text-[clamp(2.5rem,6.2vw,5.5rem)] font-semibold leading-[1.02] tracking-[-0.055em] text-balance break-words">{store.settings.heroTitle}</h1>
            <div aria-hidden="true" className="storefront-hero-rule mt-6 h-1.5 w-20 rounded-full" style={{ backgroundColor: store.settings.primaryColor }} />
            {store.settings.heroSubtitle ? <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">{store.settings.heroSubtitle}</p> : null}
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
              <Button className="storefront-shop-cta h-12 w-full rounded-full px-6 text-sm text-white shadow-lg sm:w-auto" nativeButton={false} render={<a href="#products" />} size="lg" style={{ backgroundColor: store.settings.primaryColor }}>
                <ShoppingBag aria-hidden="true" />{store.settings.copy.heroCtaLabel}<ArrowRight aria-hidden="true" />
              </Button>
              <span className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 aria-hidden="true" className="size-4 shrink-0" style={{ color: store.settings.primaryColor }} />Direct from {store.businessName}</span>
            </div>
            <div className="mt-9 grid max-w-lg grid-cols-2 gap-5 border-t border-foreground/10 pt-6">
              <div><strong className="block text-2xl font-semibold tracking-tight tabular-nums">{storeCount}<span style={{ color: store.settings.primaryColor }}>.</span></strong><span className="mt-1 block text-xs text-muted-foreground">Products to discover</span></div>
              <div className="border-l border-foreground/10 pl-5"><strong className="block text-2xl font-semibold tracking-tight">Your way<span style={{ color: store.settings.primaryColor }}>.</span></strong><span className="mt-1 block text-xs text-muted-foreground">Browse, choose, order</span></div>
            </div>
          </div>
          <div className="storefront-hero-visual relative mx-auto w-full max-w-xl px-2 sm:px-4 lg:px-0">
            <div aria-hidden="true" className="absolute inset-2 rotate-3 rounded-[2rem] border border-foreground/10 sm:rounded-[2.5rem]" />
            <div className="storefront-hero-image relative aspect-[5/4] overflow-hidden rounded-[1.75rem] bg-muted shadow-[0_25px_70px_-25px_rgb(0_0_0/0.3)] ring-1 ring-foreground/10 sm:rounded-[2.25rem] lg:aspect-[4/5]">
              {heroImage ? <Image alt={`${store.businessName} collection`} fill className="object-cover" preload sizes="(max-width: 640px) 95vw, (max-width: 1024px) 80vw, 45vw" src={heroImage} /> : <div className="storefront-hero-placeholder absolute inset-0 flex flex-col items-center justify-center p-8 text-center"><ShoppingBag aria-hidden="true" className="size-16" /><p className="mt-5 text-2xl font-semibold tracking-tight">Something for you.</p><p className="mt-2 text-sm opacity-65">Explore {store.businessName}</p></div>}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white sm:p-7">
                <div className="min-w-0"><p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/70">The collection</p><p className="mt-2 truncate text-xl font-medium tracking-tight sm:text-2xl">{store.businessName}</p></div>
                <a href="#products" aria-label="Explore the collection" className="flex size-12 shrink-0 items-center justify-center rounded-full border border-white/35 bg-white/10 backdrop-blur transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"><ArrowRight aria-hidden="true" className="size-5 -rotate-45" /></a>
              </div>
            </div>
            <div className="storefront-floating-note absolute -top-4 right-5 flex items-center gap-2.5 rounded-2xl border bg-background/95 px-4 py-3 shadow-lg backdrop-blur sm:right-0 sm:px-5">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10"><Sparkles aria-hidden="true" className="size-4" style={{ color: store.settings.primaryColor }} /></span>
              <span className="text-xs font-medium">A little discovery.<br /><span className="font-normal text-muted-foreground">A lot to love.</span></span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b bg-card">
        <div className="storefront-stagger storefront-trust-strip mx-auto flex max-w-7xl snap-x snap-mandatory gap-4 overflow-x-auto px-4 sm:grid sm:grid-cols-3 sm:gap-0 sm:divide-x sm:px-6 lg:px-8">
          <div className="storefront-trust-item flex min-w-[260px] snap-start items-center gap-3 py-5 sm:min-w-0 sm:px-5 sm:first:pl-0"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700"><CheckCircle2 aria-hidden="true" className="size-5" /></span><span><strong className="block text-sm">{store.settings.copy.trustOneTitle}</strong><span className="text-xs text-muted-foreground">{store.settings.copy.trustOneDescription}</span></span></div>
          <div className="storefront-trust-item flex min-w-[260px] snap-start items-center gap-3 py-5 sm:min-w-0 sm:px-5"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-700"><Truck aria-hidden="true" className="size-5" /></span><span><strong className="block text-sm">{store.settings.copy.trustTwoTitle}</strong><span className="text-xs text-muted-foreground">{store.settings.copy.trustTwoDescription}</span></span></div>
          <div className="storefront-trust-item flex min-w-[260px] snap-start items-center gap-3 py-5 sm:min-w-0 sm:px-5 sm:last:pr-0"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-700"><ShoppingBag aria-hidden="true" className="size-5" /></span><span><strong className="block text-sm">{store.settings.copy.trustThreeTitle}</strong><span className="text-xs text-muted-foreground">{store.settings.copy.trustThreeDescription}</span></span></div>
        </div>
      </section>

      <section className="storefront-catalogue mx-auto max-w-7xl scroll-mt-24 px-4 py-12 sm:px-6 sm:py-20 lg:px-8" id="products">
        <div data-storefront-reveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: store.settings.primaryColor }}><span className="h-px w-7" style={{ backgroundColor: store.settings.primaryColor }} />{store.settings.copy.catalogueEyebrow}</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{store.settings.copy.catalogueTitle}</h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{store.settings.copy.catalogueDescription}</p><p className="mt-2 text-xs font-medium text-muted-foreground">{totalCount} {totalCount === 1 ? "product" : "products"}{featuredCount ? ` · ${featuredCount} featured` : ""}</p></div><form action={`/store/${store.slug}`} className="relative w-full lg:max-w-md"><Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-12 rounded-full bg-card pl-11 pr-4 shadow-sm" defaultValue={query} name="query" aria-label="Search products" placeholder="Find your next favourite…" type="search" />{category ? <input name="category" type="hidden" value={category} /> : null}{preview ? <input name="preview" type="hidden" value="1" /> : null}</form></div>
        {categories.length ? <div className="storefront-category-nav mt-7 flex gap-2 overflow-x-auto pb-2"><Link className={`storefront-category-pill shrink-0 rounded-full border px-4 py-3 text-xs font-medium transition ${!category ? "text-white shadow-sm" : "bg-card hover:bg-muted"}`} href={pageHref(1, "")} style={!category ? { backgroundColor: store.settings.primaryColor, borderColor: store.settings.primaryColor } : undefined}>All products</Link>{categories.map(({ id, name }) => <Link className={`storefront-category-pill shrink-0 rounded-full border px-4 py-3 text-xs font-medium transition ${category === id ? "text-white shadow-sm" : "bg-card hover:bg-muted"}`} href={pageHref(1, id)} key={id} style={category === id ? { backgroundColor: store.settings.primaryColor, borderColor: store.settings.primaryColor } : undefined}>{name}</Link>)}</div> : null}
        {products.length ? <div className="storefront-product-grid mt-8 grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-6 md:grid-cols-3 xl:grid-cols-4" key={`${query}:${category}:${page}`}>{products.map((product) => <ProductCard key={product.id} preview={preview} product={product} store={store} />)}</div> : <div className="storefront-empty-state mt-10 rounded-[2rem] border border-dashed bg-muted/20 px-6 py-20 text-center"><span className="mx-auto flex size-16 items-center justify-center rounded-full bg-background shadow-sm"><ShoppingBag aria-hidden="true" className="size-7 text-muted-foreground" /></span><h3 className="mt-5 text-lg font-semibold">No matching products</h3><p className="mt-2 text-sm text-muted-foreground">Try another search or browse all categories.</p><Button className="mt-5 rounded-full" nativeButton={false} render={<Link href={`/store/${store.slug}${preview ? "?preview=1" : ""}`} />} variant="outline">View all products</Button></div>}
        {pageCount > 1 ? <nav aria-label="Product pages" className="mt-8 flex items-center justify-between gap-4">
          {page > 1 ? <Link className="rounded-full border px-4 py-2 text-sm" href={pageHref(page - 1)} rel="prev">Previous</Link> : <span />}
          <span className="text-sm text-muted-foreground">Page {page} of {pageCount}</span>
          {page < pageCount ? <Link className="rounded-full border px-4 py-2 text-sm" href={pageHref(page + 1)} rel="next">Next</Link> : <span />}
        </nav> : null}

      </section>
    </main>
  </StorefrontShell>
}
