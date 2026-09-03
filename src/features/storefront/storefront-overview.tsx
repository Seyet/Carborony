"use client"

import Image from "next/image"
import { useState } from "react"
import { CheckCircle2, ExternalLink, Globe2, ImagePlus, LoaderCircle, MapPin, PackageSearch, Palette, Plus, Save, Search, Store, Trash2, Truck } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button, ButtonLink } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { postJson } from "@/lib/api/client"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { storefrontSettingsSchema } from "./schemas"
import type { StorefrontAdminData, StorefrontBannerResult, StorefrontBannerUpload, StorefrontStatus } from "./types"

type SaveResult = { productCount: number; slug: string; status: string }

function nullable(value: string) {
  return value.trim() || null
}

export function StorefrontOverview({ data }: { data: StorefrontAdminData }) {
  const [settings, setSettings] = useState(data.settings)
  const [publishedIds, setPublishedIds] = useState(() => new Set(data.products.filter((product) => product.isPublished).map((product) => product.id)))
  const [featuredIds, setFeaturedIds] = useState(() => new Set(data.products.filter((product) => product.isFeatured).map((product) => product.id)))
  const [pending, setPending] = useState(false)
  const [bannerPending, setBannerPending] = useState(false)
  const [productQuery, setProductQuery] = useState("")
  const money = new Intl.NumberFormat("en", { currency: data.currencyCode, currencyDisplay: "narrowSymbol", style: "currency" })
  const previewHref = `/store/${data.slug}?preview=1`
  const liveHref = `/store/${data.slug}`
  const visibleProducts = data.products.filter((product) => product.name.toLowerCase().includes(productQuery.trim().toLowerCase()))

  function addDeliveryZone() {
    setSettings((current) => ({
      ...current,
      deliveryZones: [...current.deliveryZones, {
        coverageDetails: null,
        deliveryFee: 0,
        id: crypto.randomUUID(),
        isActive: true,
        name: "",
        position: current.deliveryZones.length,
      }],
    }))
  }

  function updateDeliveryZone(id: string, changes: Partial<StorefrontAdminData["settings"]["deliveryZones"][number]>) {
    setSettings((current) => ({
      ...current,
      deliveryZones: current.deliveryZones.map((zone) => zone.id === id ? { ...zone, ...changes } : zone),
    }))
  }

  function updateCopy<Key extends keyof StorefrontAdminData["settings"]["copy"]>(
    key: Key,
    value: StorefrontAdminData["settings"]["copy"][Key],
  ) {
    setSettings((current) => ({
      ...current,
      copy: { ...current.copy, [key]: value },
    }))
  }

  function removeDeliveryZone(id: string) {
    setSettings((current) => ({
      ...current,
      deliveryZones: current.deliveryZones.filter((zone) => zone.id !== id)
        .map((zone, position) => ({ ...zone, position })),
    }))
  }

  async function uploadBanner(file: File | undefined) {
    if (!file || bannerPending || !data.canManage) return
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast.error("Choose a JPEG, PNG, or WebP image smaller than 5 MB.")
      return
    }
    setBannerPending(true)
    const preparation = await postJson<StorefrontBannerUpload>("/api/storefront/banner", {
      operation: "prepare",
      payload: { fileName: file.name, fileSize: file.size, mimeType: file.type },
    })
    if (!preparation.ok) {
      setBannerPending(false)
      toast.error(preparation.error.message)
      return
    }
    const upload = await createSupabaseClient().storage.from("storefront-media")
      .uploadToSignedUrl(preparation.data.path, preparation.data.token, file, { contentType: file.type })
    if (upload.error) {
      setBannerPending(false)
      toast.error("We couldn't upload the website banner. Please try again.")
      return
    }
    const finalization = await postJson<StorefrontBannerResult>("/api/storefront/banner", {
      operation: "finalize",
      payload: { storagePath: preparation.data.path },
    })
    setBannerPending(false)
    if (!finalization.ok) {
      toast.error(finalization.error.message)
      return
    }
    setSettings((current) => ({ ...current, heroBannerUrl: finalization.data.bannerUrl }))
    toast.success(finalization.message ?? "Website banner updated.")
  }

  async function removeBanner() {
    if (bannerPending || !data.canManage) return
    setBannerPending(true)
    const response = await postJson<StorefrontBannerResult>("/api/storefront/banner", {
      operation: "remove",
      payload: {},
    })
    setBannerPending(false)
    if (!response.ok) {
      toast.error(response.error.message)
      return
    }
    setSettings((current) => ({ ...current, heroBannerUrl: null }))
    toast.success(response.message ?? "Website banner removed.")
  }

  function togglePublished(productId: string) {
    setPublishedIds((current) => {
      const next = new Set(current)
      if (next.has(productId)) {
        next.delete(productId)
        setFeaturedIds((featured) => {
          const updated = new Set(featured)
          updated.delete(productId)
          return updated
        })
      } else next.add(productId)
      return next
    })
  }

  function toggleFeatured(productId: string) {
    if (!publishedIds.has(productId)) return
    setFeaturedIds((current) => {
      const next = new Set(current)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  async function save(requestedStatus: StorefrontStatus) {
    if (pending || !data.canManage) return
    const payload = {
      ...settings,
      announcement: nullable(settings.announcement ?? ""),
      bankTransferInstructions: nullable(settings.bankTransferInstructions ?? ""),
      contactEmail: nullable(settings.contactEmail ?? ""),
      contactPhone: nullable(settings.contactPhone ?? ""),
      featuredProductIds: [...featuredIds],
      heroSubtitle: nullable(settings.heroSubtitle ?? ""),
      pickupAddress: nullable(settings.pickupAddress ?? ""),
      publishedProductIds: [...publishedIds],
      requestedStatus,
      seoDescription: nullable(settings.seoDescription ?? ""),
      seoTitle: nullable(settings.seoTitle ?? ""),
    }
    const validation = storefrontSettingsSchema.safeParse(payload)
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? "Check the storefront settings.")
      return
    }
    setPending(true)
    const response = await postJson<SaveResult>("/api/storefront", validation.data)
    setPending(false)
    if (!response.ok) {
      toast.error(response.error.message)
      return
    }
    setSettings((current) => ({ ...current, status: response.data.status as StorefrontStatus }))
    toast.success(response.message ?? "Storefront saved.")
  }

  const fieldClass = "grid gap-2 text-sm font-medium"
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Online storefront</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">My Website</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Design, publish, and operate the online store for {data.businessName}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={previewHref} target="_blank" variant="outline"><Globe2 aria-hidden="true" />Preview<ExternalLink aria-hidden="true" /></ButtonLink>
          <Button disabled={pending || !data.canManage} onClick={() => save(settings.status)} variant="outline">{pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}{settings.status === "draft" ? "Save draft" : "Save changes"}</Button>
          {settings.status === "published" ? (
            <Button disabled={pending || !data.canManage} onClick={() => save("paused")} variant="secondary">Pause store</Button>
          ) : (
            <Button disabled={pending || !data.canManage} onClick={() => save("published")}><Store aria-hidden="true" />Publish store</Button>
          )}
        </div>
      </header>

      <Card className="bg-foreground text-background ring-0">
        <CardContent className="flex flex-col gap-5 px-5 py-2 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge className="bg-background/10 text-background" variant="secondary">{settings.status === "published" ? "Storefront live" : settings.status === "paused" ? "Storefront paused" : "Draft storefront"}</Badge>
            <h2 className="mt-3 text-xl font-semibold">{publishedIds.size} products selected for your online store</h2>
            <p className="mt-1 text-sm text-background/65">Your store address is /store/{data.slug}</p>
          </div>
          {settings.status === "published" ? <ButtonLink href={liveHref} target="_blank" variant="secondary">Visit live store<ExternalLink aria-hidden="true" /></ButtonLink> : null}
        </CardContent>
      </Card>

      <Tabs defaultValue="design">
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="design"><Palette aria-hidden="true" />Design</TabsTrigger>
          <TabsTrigger value="products"><PackageSearch aria-hidden="true" />Products</TabsTrigger>
          <TabsTrigger value="fulfilment"><Truck aria-hidden="true" />Checkout</TabsTrigger>
          <TabsTrigger value="seo"><Search aria-hidden="true" />Contact & SEO</TabsTrigger>
        </TabsList>

        <TabsContent value="design">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader><CardTitle as="h2">Store design</CardTitle><CardDescription>Set the message and colour customers see first.</CardDescription></CardHeader>
              <CardContent className="grid gap-5">
                <label className={fieldClass}>Announcement<Input maxLength={160} onChange={(event) => setSettings({ ...settings, announcement: event.currentTarget.value })} placeholder="Free delivery on orders over ₦50,000" value={settings.announcement ?? ""} /></label>
                <div className={fieldClass}><span>Website banner <span className="font-normal text-muted-foreground">(optional)</span></span>{settings.heroBannerUrl ? <div className="relative aspect-[3/1] overflow-hidden rounded-xl border bg-muted"><Image alt="Website banner preview" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 60vw" src={settings.heroBannerUrl} unoptimized /></div> : <div className="flex aspect-[3/1] items-center justify-center rounded-xl border border-dashed bg-muted/30 text-xs text-muted-foreground">No banner image selected</div>}<div className="flex flex-wrap gap-2"><label className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"><ImagePlus aria-hidden="true" className="size-3.5" />{bannerPending ? "Uploading…" : settings.heroBannerUrl ? "Replace banner" : "Upload banner"}<input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={bannerPending || !data.canManage} onChange={(event) => { void uploadBanner(event.currentTarget.files?.[0]); event.currentTarget.value = "" }} type="file" /></label>{settings.heroBannerUrl ? <Button disabled={bannerPending || !data.canManage} onClick={() => void removeBanner()} size="sm" type="button" variant="outline"><Trash2 aria-hidden="true" />Remove</Button> : null}</div><span className="text-xs font-normal text-muted-foreground">JPEG, PNG, or WebP · up to 5 MB · a wide 3:1 image works best.</span></div>
                <label className={fieldClass}>Hero title<Input maxLength={100} onChange={(event) => setSettings({ ...settings, heroTitle: event.currentTarget.value })} value={settings.heroTitle} /></label>
                <label className={fieldClass}>Hero subtitle<Textarea maxLength={240} onChange={(event) => setSettings({ ...settings, heroSubtitle: event.currentTarget.value })} value={settings.heroSubtitle ?? ""} /></label>
                <label className={fieldClass}>Brand colour<div className="flex gap-2"><Input aria-label="Brand colour picker" className="h-10 w-14 p-1" onChange={(event) => setSettings({ ...settings, primaryColor: event.currentTarget.value })} type="color" value={settings.primaryColor} /><Input maxLength={7} onChange={(event) => setSettings({ ...settings, primaryColor: event.currentTarget.value })} value={settings.primaryColor} /></div></label>
              </CardContent>
            </Card>
            <Card style={{ borderTop: `5px solid ${settings.primaryColor}` }}>
              <CardHeader><CardTitle>Homepage preview</CardTitle></CardHeader>
              <CardContent>
                {settings.announcement ? <p className="mb-5 rounded-lg px-3 py-2 text-center text-xs text-white" style={{ backgroundColor: settings.primaryColor }}>{settings.announcement}</p> : null}
                <div className="overflow-hidden rounded-xl bg-muted text-center">{settings.heroBannerUrl ? <div className="relative aspect-[3/1]"><Image alt="Website hero banner" fill className="object-cover" sizes="320px" src={settings.heroBannerUrl} unoptimized /></div> : <div className="p-5"><Store aria-hidden="true" className="mx-auto size-8" style={{ color: settings.primaryColor }} /></div>}<div className="p-5"><p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: settings.primaryColor }}>{settings.copy.heroEyebrow}</p><h3 className="mt-2 text-xl font-semibold">{settings.heroTitle || "Your headline"}</h3><p className="mt-2 text-sm text-muted-foreground">{settings.heroSubtitle || "Your store description appears here."}</p><span className="mt-5 inline-flex rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: settings.primaryColor }}>{settings.copy.heroCtaLabel}</span></div></div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle as="h2">Storefront wording</CardTitle><CardDescription>Make the customer-facing messages sound like your brand. These changes appear throughout the homepage.</CardDescription></CardHeader>
              <CardContent className="grid gap-6">
                <div><h3 className="text-sm font-semibold">Hero</h3><p className="mt-1 text-xs text-muted-foreground">The small welcome label and main shopping button.</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className={fieldClass}>Welcome label<Input maxLength={80} onChange={(event) => updateCopy("heroEyebrow", event.currentTarget.value)} placeholder={`Welcome to ${data.businessName}`} value={settings.copy.heroEyebrow} /></label><label className={fieldClass}>Button label<Input maxLength={40} onChange={(event) => updateCopy("heroCtaLabel", event.currentTarget.value)} placeholder="Shop the collection" value={settings.copy.heroCtaLabel} /></label></div></div>
                <div className="border-t pt-5"><h3 className="text-sm font-semibold">Catalogue introduction</h3><p className="mt-1 text-xs text-muted-foreground">The message customers see above your product grid.</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className={fieldClass}>Section label<Input maxLength={60} onChange={(event) => updateCopy("catalogueEyebrow", event.currentTarget.value)} value={settings.copy.catalogueEyebrow} /></label><label className={fieldClass}>Section title<Input maxLength={80} onChange={(event) => updateCopy("catalogueTitle", event.currentTarget.value)} value={settings.copy.catalogueTitle} /></label><label className={`${fieldClass} sm:col-span-2`}>Section description<Textarea maxLength={160} onChange={(event) => updateCopy("catalogueDescription", event.currentTarget.value)} rows={2} value={settings.copy.catalogueDescription} /></label></div></div>
                <div className="border-t pt-5"><h3 className="text-sm font-semibold">Customer reassurance</h3><p className="mt-1 text-xs text-muted-foreground">Three short promises shown between the hero and catalogue.</p><div className="mt-3 grid gap-4 lg:grid-cols-3">{([
                  ["trustOneTitle", "trustOneDescription", "First message"],
                  ["trustTwoTitle", "trustTwoDescription", "Second message"],
                  ["trustThreeTitle", "trustThreeDescription", "Third message"],
                ] as const).map(([titleKey, descriptionKey, label]) => <div className="grid gap-3 rounded-xl border bg-muted/15 p-4" key={titleKey}><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><label className={fieldClass}>Title<Input maxLength={50} onChange={(event) => updateCopy(titleKey, event.currentTarget.value)} value={settings.copy[titleKey]} /></label><label className={fieldClass}>Description<Textarea maxLength={100} onChange={(event) => updateCopy(descriptionKey, event.currentTarget.value)} rows={2} value={settings.copy[descriptionKey]} /></label></div>)}</div></div>
                <div className="border-t pt-5"><label className={fieldClass}>Footer tagline <span className="font-normal text-muted-foreground">(shown beside your contact details)</span><Textarea maxLength={240} onChange={(event) => updateCopy("footerTagline", event.currentTarget.value)} rows={3} value={settings.copy.footerTagline} /></label></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeader><CardTitle as="h2">Online products</CardTitle><CardDescription>Only active products can be published. Featured products appear first.</CardDescription></CardHeader>
            <CardContent>
              <div className="relative mb-4"><Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-10 pl-9" onChange={(event) => setProductQuery(event.currentTarget.value)} placeholder="Search products" value={productQuery} /></div>
              <div className="divide-y rounded-xl border">
                {visibleProducts.map((product) => {
                  const active = product.status === "active"
                  const published = publishedIds.has(product.id)
                  return <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center" key={product.id}>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">{product.imageUrl ? <Image alt="" fill className="object-cover" sizes="48px" src={product.imageUrl} unoptimized /> : <PackageSearch aria-hidden="true" className="absolute inset-0 m-auto size-5 text-muted-foreground" />}</span>
                      <span className="min-w-0"><span className="block truncate font-medium">{product.name}</span><span className="block text-xs text-muted-foreground">{product.categoryName ?? "Uncategorised"} · {money.format(product.sellingPrice)}</span></span>
                      {!active ? <Badge variant="secondary">{product.status}</Badge> : null}
                    </div>
                    <div className="flex items-center gap-5 pl-15 sm:pl-0">
                      <label className="flex items-center gap-2 text-xs"><input checked={featuredIds.has(product.id)} disabled={!published} onChange={() => toggleFeatured(product.id)} type="checkbox" />Featured</label>
                      <label className="flex items-center gap-2 text-xs"><input checked={published} disabled={!active} onChange={() => togglePublished(product.id)} type="checkbox" />Published</label>
                    </div>
                  </div>
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fulfilment">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle as="h2">Delivery and pickup</CardTitle><CardDescription>Charge the correct amount by defining each area you deliver to.</CardDescription></CardHeader><CardContent className="grid gap-5">
              <label className="flex items-start gap-3"><input checked={settings.deliveryEnabled} className="mt-1" onChange={(event) => setSettings({ ...settings, deliveryEnabled: event.currentTarget.checked })} type="checkbox" /><span><strong className="block text-sm">Offer delivery</strong><span className="text-xs text-muted-foreground">Collect a delivery address during checkout.</span></span></label>
              {settings.deliveryEnabled ? <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-medium">Delivery zones</h3><p className="text-xs text-muted-foreground">Customers select one of the active zones at checkout.</p></div><Button onClick={addDeliveryZone} size="sm" type="button" variant="outline"><Plus aria-hidden="true" />Add zone</Button></div>
                {settings.deliveryZones.length ? settings.deliveryZones.map((zone) => <div className="grid gap-3 rounded-xl border p-4" key={zone.id}>
                  <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm font-medium"><MapPin aria-hidden="true" className="size-4 text-muted-foreground" />{zone.name || "New delivery zone"}</span><Button aria-label={`Remove ${zone.name || "delivery zone"}`} onClick={() => removeDeliveryZone(zone.id)} size="icon-sm" type="button" variant="ghost"><Trash2 aria-hidden="true" /></Button></div>
                  <div className="grid gap-3 sm:grid-cols-2"><label className={fieldClass}>Zone name<Input maxLength={80} onChange={(event) => updateDeliveryZone(zone.id, { name: event.currentTarget.value })} placeholder="Lagos Island" value={zone.name} /></label><label className={fieldClass}>Delivery price<Input min="0" onChange={(event) => updateDeliveryZone(zone.id, { deliveryFee: Number(event.currentTarget.value) })} step="0.01" type="number" value={zone.deliveryFee} /></label></div>
                  <label className={fieldClass}>Areas covered <span className="font-normal text-muted-foreground">(optional)</span><Textarea maxLength={300} onChange={(event) => updateDeliveryZone(zone.id, { coverageDetails: event.currentTarget.value })} placeholder="Ikoyi, Victoria Island, Lekki Phase 1" value={zone.coverageDetails ?? ""} /></label>
                  <label className="flex items-center gap-2 text-xs"><input checked={zone.isActive} onChange={(event) => updateDeliveryZone(zone.id, { isActive: event.currentTarget.checked })} type="checkbox" />Available to customers</label>
                </div>) : <div className="rounded-xl border border-dashed p-5 text-center"><MapPin aria-hidden="true" className="mx-auto size-6 text-muted-foreground" /><p className="mt-2 text-sm font-medium">No delivery zones yet</p><p className="mt-1 text-xs text-muted-foreground">Add a zone and its delivery price before saving.</p></div>}
              </div> : null}
              <label className="flex items-start gap-3"><input checked={settings.pickupEnabled} className="mt-1" onChange={(event) => setSettings({ ...settings, pickupEnabled: event.currentTarget.checked })} type="checkbox" /><span><strong className="block text-sm">Offer pickup</strong><span className="text-xs text-muted-foreground">Customers can collect their order.</span></span></label>
              {settings.pickupEnabled ? <label className={fieldClass}>Pickup address<Textarea maxLength={500} onChange={(event) => setSettings({ ...settings, pickupAddress: event.currentTarget.value })} value={settings.pickupAddress ?? ""} /></label> : null}
            </CardContent></Card>
            <Card><CardHeader><CardTitle as="h2">Payment methods</CardTitle><CardDescription>Payments are confirmed by staff from the order workspace.</CardDescription></CardHeader><CardContent className="grid gap-5">
              <label className="flex items-start gap-3"><input checked={settings.payOnDeliveryEnabled} className="mt-1" onChange={(event) => setSettings({ ...settings, payOnDeliveryEnabled: event.currentTarget.checked })} type="checkbox" /><span><strong className="block text-sm">Pay on delivery or pickup</strong><span className="text-xs text-muted-foreground">Collect cash or confirm another payment when fulfilling.</span></span></label>
              <label className="flex items-start gap-3"><input checked={settings.bankTransferEnabled} className="mt-1" onChange={(event) => setSettings({ ...settings, bankTransferEnabled: event.currentTarget.checked })} type="checkbox" /><span><strong className="block text-sm">Bank transfer</strong><span className="text-xs text-muted-foreground">Show transfer instructions after checkout.</span></span></label>
              {settings.bankTransferEnabled ? <label className={fieldClass}>Bank transfer instructions<Textarea maxLength={1000} onChange={(event) => setSettings({ ...settings, bankTransferInstructions: event.currentTarget.value })} placeholder="Bank name, account name, account number, and reference instructions" value={settings.bankTransferInstructions ?? ""} /></label> : null}
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="seo">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle as="h2">Customer contact</CardTitle></CardHeader><CardContent className="grid gap-5"><label className={fieldClass}>Contact email<Input onChange={(event) => setSettings({ ...settings, contactEmail: event.currentTarget.value })} type="email" value={settings.contactEmail ?? ""} /></label><label className={fieldClass}>Contact phone<Input maxLength={32} onChange={(event) => setSettings({ ...settings, contactPhone: event.currentTarget.value })} type="tel" value={settings.contactPhone ?? ""} /></label></CardContent></Card>
            <Card><CardHeader><CardTitle as="h2">Search appearance</CardTitle></CardHeader><CardContent className="grid gap-5"><label className={fieldClass}>SEO title<Input maxLength={70} onChange={(event) => setSettings({ ...settings, seoTitle: event.currentTarget.value })} value={settings.seoTitle ?? ""} /></label><label className={fieldClass}>SEO description<Textarea maxLength={170} onChange={(event) => setSettings({ ...settings, seoDescription: event.currentTarget.value })} value={settings.seoDescription ?? ""} /></label></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>

      {!data.canManage ? <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">You have read-only access to this storefront. Ask an owner or administrator to make changes.</div> : null}
      <div className="flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600" /><p>Catalogue prices, availability, customers, and orders remain connected to the rest of Carborony. Storefront orders appear automatically in Orders.</p></div>
    </div>
  )
}
