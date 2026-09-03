"use client"

import Image from "next/image"
import Link from "next/link"
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { ArrowRight, CheckCircle2, LoaderCircle, Mail, Minus, Package, Phone, Plus, ShieldCheck, ShoppingBag, ShoppingCart, Store, Trash2, Truck } from "lucide-react"
import { toast } from "sonner"

import { Button, ButtonLink } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { postJson } from "@/lib/api/client"
import { storefrontCheckoutSchema } from "./schemas"
import type { PublicStorefront, StorefrontCheckoutResult, StorefrontProduct, StorefrontVariant } from "./types"

type CartItem = {
  imageUrl: string | null
  maxStock: number | null
  name: string
  productId: string
  quantity: number
  unitPrice: number
  variantId: string | null
  variantName: string | null
}

type CartContextValue = {
  add: (product: StorefrontProduct, variant?: StorefrontVariant) => void
  cart: CartItem[]
  clear: () => void
  remove: (key: string) => void
  update: (key: string, quantity: number) => void
}

const CartContext = createContext<CartContextValue | null>(null)

function itemKey(item: Pick<CartItem, "productId" | "variantId">) {
  return `${item.productId}:${item.variantId ?? "base"}`
}

function useCart() {
  const value = useContext(CartContext)
  if (!value) throw new Error("Storefront cart is unavailable.")
  return value
}

function variantDetails(variant: StorefrontVariant) {
  return Object.entries(variant.attributes).map(([name, value]) => `${name}: ${value}`).join(" · ")
}

function productImageUrl(product: StorefrontProduct, variant?: StorefrontVariant) {
  return variant?.imageUrls[0]
    ?? product.imageUrls[0]
    ?? product.variants.find((item) => item.imageUrls.length)?.imageUrls[0]
    ?? null
}

function CartProvider({ children, slug }: { children: ReactNode; slug: string }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)
  const storageKey = `carborony-storefront-cart:${slug}`

  useEffect(() => {
    let restored: CartItem[] = []
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) restored = JSON.parse(stored) as CartItem[]
    } catch {
      localStorage.removeItem(storageKey)
    }
    const frame = requestAnimationFrame(() => {
      setCart(restored)
      setHydrated(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [storageKey])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(storageKey, JSON.stringify(cart))
  }, [cart, hydrated, storageKey])

  const value = useMemo<CartContextValue>(() => ({
    add(product, variant) {
      const next: CartItem = {
        imageUrl: productImageUrl(product, variant),
        maxStock: product.trackInventory ? (variant?.stockQuantity ?? product.availableStock ?? 0) : null,
        name: product.name,
        productId: product.id,
        quantity: 1,
        unitPrice: variant?.sellingPrice ?? product.discountPrice ?? product.sellingPrice,
        variantId: variant?.id ?? null,
        variantName: variant ? variantDetails(variant) || variant.name : null,
      }
      setCart((current) => {
        const key = itemKey(next)
        const existing = current.find((item) => itemKey(item) === key)
        if (!existing) return [...current, next]
        return current.map((item) => itemKey(item) === key
          ? { ...item, quantity: Math.min(item.quantity + 1, item.maxStock ?? 10_000) }
          : item)
      })
      toast.success(`${product.name} added to cart`)
    },
    cart,
    clear: () => setCart([]),
    remove: (key) => setCart((current) => current.filter((item) => itemKey(item) !== key)),
    update: (key, quantity) => setCart((current) => current.map((item) => itemKey(item) === key
      ? { ...item, quantity: Math.max(1, Math.min(quantity, item.maxStock ?? 10_000)) }
      : item)),
  }), [cart])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

function StoreHeader({ store, preview }: { preview: boolean; store: PublicStorefront }) {
  const { cart } = useCart()
  const count = cart.reduce((total, item) => total + item.quantity, 0)
  const previewSuffix = preview ? "?preview=1" : ""
  return <>
    {preview ? <div className="bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-950">Storefront preview — customers cannot see this draft.</div> : null}
    {store.settings.announcement ? <div className="px-4 py-2.5 text-center text-xs font-semibold tracking-wide text-white" style={{ backgroundColor: store.settings.primaryColor }}>{store.settings.announcement}</div> : null}
    <header className="sticky top-0 z-30 border-b bg-background/85 shadow-xs backdrop-blur-xl">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link className="group flex min-w-0 items-center gap-3 font-semibold" href={`/store/${store.slug}${previewSuffix}`}>
          {store.logoUrl ? <span className="relative size-11 overflow-hidden rounded-xl shadow-sm ring-1 ring-foreground/10"><Image alt={`${store.businessName} logo`} fill className="object-cover transition group-hover:scale-105" sizes="44px" src={store.logoUrl} unoptimized /></span> : <span className="flex size-11 items-center justify-center rounded-xl text-white shadow-sm" style={{ backgroundColor: store.settings.primaryColor }}><Store aria-hidden="true" className="size-5" /></span>}
          <span className="truncate text-base tracking-tight">{store.businessName}</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm sm:gap-2"><Link className="hidden rounded-full px-4 py-2 font-medium transition hover:bg-muted sm:block" href={`/store/${store.slug}${previewSuffix}`}>Shop</Link><Link aria-label={`Cart with ${count} items`} className="relative flex h-11 items-center gap-2 rounded-full border bg-card px-3.5 font-medium shadow-xs transition hover:-translate-y-0.5 hover:shadow-sm" href={`/store/${store.slug}/cart${previewSuffix}`}><ShoppingBag aria-hidden="true" className="size-4.5" /><span className="hidden sm:inline">Cart</span>{count ? <span className="flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: store.settings.primaryColor }}>{count}</span> : null}</Link></nav>
      </div>
    </header>
  </>
}

export function StorefrontShell({ children, preview = false, store }: { children: ReactNode; preview?: boolean; store: PublicStorefront }) {
  const previewSuffix = preview ? "?preview=1" : ""
  return <CartProvider slug={store.slug}>
    <div className="min-h-screen bg-background text-foreground selection:bg-[var(--store-color)]/20" style={{ "--store-color": store.settings.primaryColor } as React.CSSProperties}>
      <StoreHeader preview={preview} store={store} />
      {children}
      <footer className="mt-16 bg-foreground text-background">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_0.7fr_0.8fr] lg:px-8">
          <div><div className="flex items-center gap-3">{store.logoUrl ? <span className="relative size-11 overflow-hidden rounded-xl bg-background"><Image alt="" fill className="object-cover" sizes="44px" src={store.logoUrl} unoptimized /></span> : <span className="flex size-11 items-center justify-center rounded-xl bg-background/10"><Store aria-hidden="true" className="size-5" /></span>}<p className="text-lg font-semibold">{store.businessName}</p></div><p className="mt-4 max-w-sm text-sm leading-6 text-background/60">{store.settings.copy.footerTagline}</p></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-background/45">Explore</p><div className="mt-4 grid gap-3 text-sm"><Link className="w-fit transition hover:text-background/60" href={`/store/${store.slug}${previewSuffix}`}>Shop all products</Link><a className="w-fit transition hover:text-background/60" href="#products">Browse catalogue</a></div></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-background/45">Get in touch</p><div className="mt-4 grid gap-3 text-sm">{store.settings.contactEmail ? <a className="flex items-center gap-2 transition hover:text-background/60" href={`mailto:${store.settings.contactEmail}`}><Mail aria-hidden="true" className="size-4" />{store.settings.contactEmail}</a> : null}{store.settings.contactPhone ? <a className="flex items-center gap-2 transition hover:text-background/60" href={`tel:${store.settings.contactPhone}`}><Phone aria-hidden="true" className="size-4" />{store.settings.contactPhone}</a> : null}<span className="flex items-center gap-2 text-background/60"><ShieldCheck aria-hidden="true" className="size-4" />Secure ordering</span></div></div>
        </div>
        <div className="border-t border-background/10"><div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-background/45 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><p>© {new Date().getFullYear()} {store.businessName}</p><p>Storefront powered by Carborony</p></div></div>
      </footer>
    </div>
  </CartProvider>
}

export function ProductCard({ preview = false, product, store }: { preview?: boolean; product: StorefrontProduct; store: PublicStorefront }) {
  const { add } = useCart()
  const outOfStock = product.trackInventory && (product.variants.length ? product.variants.every((variant) => variant.stockQuantity <= 0) : (product.availableStock ?? 0) <= 0)
  const money = new Intl.NumberFormat("en", { currency: store.currencyCode, currencyDisplay: "narrowSymbol", style: "currency" })
  const variantPrices = product.variants.map((variant) => variant.sellingPrice)
  const minimumPrice = variantPrices.length ? Math.min(...variantPrices) : product.discountPrice ?? product.sellingPrice
  const maximumPrice = variantPrices.length ? Math.max(...variantPrices) : minimumPrice
  const priceLabel = minimumPrice === maximumPrice
    ? money.format(minimumPrice)
    : `${money.format(minimumPrice)} – ${money.format(maximumPrice)}`
  const href = `/store/${store.slug}/products/${product.id}${preview ? "?preview=1" : ""}`
  const imageUrl = productImageUrl(product)
  const discountPercentage = product.discountPrice !== null && product.sellingPrice > 0 && !product.variants.length
    ? Math.round(((product.sellingPrice - product.discountPrice) / product.sellingPrice) * 100)
    : 0
  return <article className="group flex min-w-0 flex-col overflow-hidden rounded-[1.5rem] bg-card shadow-sm ring-1 ring-foreground/8 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
    <Link className="relative block aspect-[4/5] overflow-hidden bg-muted" href={href}>{imageUrl ? <Image alt={product.name} fill className="object-cover transition duration-500 group-hover:scale-105" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" src={imageUrl} unoptimized /> : <><div className="absolute inset-0 opacity-50" style={{ background: `radial-gradient(circle at 50% 35%, color-mix(in srgb, ${store.settings.primaryColor} 18%, transparent), transparent 50%)` }} /><Package aria-hidden="true" className="absolute inset-0 m-auto size-12 text-muted-foreground/35" /></>}{product.isFeatured ? <span className="absolute top-3 left-3 rounded-full bg-foreground/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-background backdrop-blur">Featured</span> : null}{outOfStock ? <span className="absolute right-3 bottom-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur">Sold out</span> : discountPercentage > 0 ? <span className="absolute right-3 bottom-3 rounded-full px-2.5 py-1 text-xs font-bold text-white shadow-sm" style={{ backgroundColor: store.settings.primaryColor }}>Save {discountPercentage}%</span> : null}<span className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/15 to-transparent opacity-0 transition group-hover:opacity-100" /></Link>
    <div className="flex flex-1 flex-col p-3.5 sm:p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{product.categoryName ?? "Shop"}</p><Link className="mt-1.5 line-clamp-2 min-h-10 text-sm font-semibold leading-5 tracking-tight hover:underline sm:text-base" href={href}>{product.name}</Link>{product.description ? <p className="mt-2 hidden line-clamp-2 text-xs leading-5 text-muted-foreground sm:block">{product.description}</p> : null}<div className="mt-auto flex flex-col gap-3 pt-4 sm:flex-row sm:items-end sm:justify-between"><p className="min-w-0"><strong className="block truncate text-sm tabular-nums sm:text-base">{priceLabel}</strong>{product.discountPrice !== null && !product.variants.length ? <span className="text-[11px] text-muted-foreground line-through">{money.format(product.sellingPrice)}</span> : null}</p>{product.variants.length ? <ButtonLink className="rounded-full" href={href} size="sm" variant="outline">Choose<ArrowRight aria-hidden="true" /></ButtonLink> : <Button className="rounded-full text-white" disabled={outOfStock} onClick={() => add(product)} size="sm" style={{ backgroundColor: outOfStock ? undefined : store.settings.primaryColor }}><Plus aria-hidden="true" />Add</Button>}</div></div>
  </article>
}

export function StorefrontProductView({ product, store }: { product: StorefrontProduct; store: PublicStorefront }) {
  const { add } = useCart()
  const optionGroups = useMemo(() => {
    const groups = new Map<string, { name: string; values: string[] }>()
    product.variants.forEach((variant) => Object.entries(variant.attributes).forEach(([name, value]) => {
      const key = name.toLocaleLowerCase()
      const group = groups.get(key) ?? { name, values: [] }
      if (!group.values.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) group.values.push(value)
      groups.set(key, group)
    }))
    return [...groups.values()]
  }, [product.variants])
  const initialVariant = product.variants.find((item) => !product.trackInventory || item.stockQuantity > 0) ?? product.variants[0]
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => Object.fromEntries(
    optionGroups.map((group) => [
      group.name,
      Object.entries(initialVariant?.attributes ?? {}).find(([name]) => name.toLocaleLowerCase() === group.name.toLocaleLowerCase())?.[1]
        ?? group.values[0]
        ?? "",
    ]),
  ))
  const [variantId, setVariantId] = useState(initialVariant?.id ?? "")
  function attributeValue(variant: StorefrontVariant, name: string) {
    return Object.entries(variant.attributes)
      .find(([attributeName]) => attributeName.toLocaleLowerCase() === name.toLocaleLowerCase())?.[1]
  }
  function matchesSelection(variant: StorefrontVariant, ignoredOption?: string) {
    return optionGroups.every((group) => {
      if (group.name === ignoredOption) return true
      const selectedValue = selectedOptions[group.name]
      return !selectedValue || attributeValue(variant, group.name)?.toLocaleLowerCase() === selectedValue.toLocaleLowerCase()
    })
  }
  const variant = optionGroups.length
    ? product.variants.find((item) => matchesSelection(item))
    : product.variants.find((item) => item.id === variantId)
  const available = product.trackInventory ? (variant?.stockQuantity ?? product.availableStock ?? 0) : null
  const variantImages = variant?.imageUrls ?? []
  const galleryImages = [...new Set(variantImages.length
    ? [...variantImages, ...product.imageUrls]
    : product.imageUrls.length
      ? product.imageUrls
      : product.variants.flatMap((item) => item.imageUrls).slice(0, 1))]
  const selectedDetails = variant ? variantDetails(variant) : ""
  const price = variant?.sellingPrice ?? product.discountPrice ?? product.sellingPrice
  const money = new Intl.NumberFormat("en", {
    currency: store.currencyCode,
    currencyDisplay: "narrowSymbol",
    style: "currency",
  })
  const cannotAdd = Boolean(product.variants.length && !variant)
    || (available !== null && available <= 0)

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-12">
      <div className="grid content-start gap-3 sm:grid-cols-2">
        {galleryImages.length ? galleryImages.map((url, index) => (
          <div
            className={`relative overflow-hidden rounded-[1.75rem] bg-muted shadow-sm ring-1 ring-foreground/8 ${index === 0 ? "aspect-square sm:col-span-2" : "aspect-square"}`}
            key={url}
          >
            <Image
              alt={`${product.name}${variant ? `, ${variant.name}` : ""}${index ? `, image ${index + 1}` : ""}`}
              className="object-cover"
              fill
              priority={index === 0}
              sizes={index === 0 ? "(max-width: 1024px) 100vw, 60vw" : "(max-width: 640px) 100vw, 30vw"}
              src={url}
              unoptimized
            />
          </div>
        )) : (
          <div className="relative aspect-square rounded-[1.75rem] bg-muted shadow-sm ring-1 ring-foreground/8 sm:col-span-2">
            <Package aria-hidden="true" className="absolute inset-0 m-auto size-20 text-muted-foreground/30" />
          </div>
        )}
      </div>

      <section className="rounded-[1.75rem] bg-card p-5 shadow-sm ring-1 ring-foreground/8 sm:p-7 lg:sticky lg:top-24 lg:self-start">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: store.settings.primaryColor }}><span className="size-1.5 rounded-full" style={{ backgroundColor: store.settings.primaryColor }} />{product.categoryName ?? "Shop"}</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] text-balance sm:text-4xl">{product.name}</h1>
        <div className="mt-4 flex items-center gap-3">
          <strong className="text-2xl tracking-tight tabular-nums sm:text-3xl">{money.format(price)}</strong>
          {product.discountPrice !== null && !product.variants.length ? (
            <span className="text-sm text-muted-foreground line-through">{money.format(product.sellingPrice)}</span>
          ) : null}
        </div>

        {product.description ? <p className="mt-6 whitespace-pre-wrap leading-7 text-muted-foreground">{product.description}</p> : null}

        <div className="mt-7 space-y-5 border-t pt-6">
          {optionGroups.length ? optionGroups.map((group) => (
            <fieldset className="grid gap-2" key={group.name}>
              <legend className="text-sm font-medium">{group.name}</legend>
              <div className="flex flex-wrap gap-2">
                {group.values.map((value) => {
                  const selected = selectedOptions[group.name]?.toLocaleLowerCase() === value.toLocaleLowerCase()
                  const availableValue = product.variants.some((item) =>
                    attributeValue(item, group.name)?.toLocaleLowerCase() === value.toLocaleLowerCase()
                    && matchesSelection(item, group.name)
                    && (!product.trackInventory || item.stockQuantity > 0),
                  )
                  return (
                    <button
                      aria-pressed={selected}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${selected ? "text-white shadow-sm" : "hover:bg-muted"} ${!availableValue ? "cursor-not-allowed opacity-40 line-through" : ""}`}
                      disabled={!availableValue}
                      key={value}
                      onClick={() => setSelectedOptions((current) => ({ ...current, [group.name]: value }))}
                      style={selected ? { backgroundColor: store.settings.primaryColor, borderColor: store.settings.primaryColor } : undefined}
                      type="button"
                    >
                      {value}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )) : product.variants.length ? (
            <label className="grid gap-2 text-sm font-medium">
              Option
              <select
                className="h-11 rounded-lg border bg-background px-3"
                onChange={(event) => setVariantId(event.currentTarget.value)}
                value={variantId}
              >
                {product.variants.map((item) => (
                  <option disabled={product.trackInventory && item.stockQuantity <= 0} key={item.id} value={item.id}>
                    {item.name}{product.trackInventory && item.stockQuantity <= 0 ? " — sold out" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {variant ? (
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected variant</p>
                  <p className="mt-1 font-semibold">{variant.name}</p>
                </div>
                <span className={`text-xs font-medium ${available !== null && available <= 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"}`}>
                  {available === null ? "Available" : available <= 0 ? "Sold out" : `${available.toLocaleString()} in stock`}
                </span>
              </div>
              {selectedDetails ? <p className="mt-2 text-sm text-muted-foreground">{selectedDetails}</p> : null}
              {variant.sku ? <p className="mt-2 text-xs text-muted-foreground">SKU: {variant.sku}</p> : null}
            </div>
          ) : null}

          <Button
            className="h-12 w-full rounded-full text-white shadow-lg"
            disabled={cannotAdd}
            onClick={() => { if (!cannotAdd) add(product, variant) }}
            size="lg"
            style={{ backgroundColor: cannotAdd ? undefined : store.settings.primaryColor }}
          >
            <ShoppingCart aria-hidden="true" />{available !== null && available <= 0 ? "Sold out" : "Add to cart"}
          </Button>
          {available !== null && available > 0 && available <= 5 ? <p className="text-center text-xs text-amber-700">Only {available} left</p> : null}
          <div className="grid grid-cols-2 gap-3 border-t pt-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-emerald-600" />Verified at checkout</span><span className="flex items-center gap-2"><Truck aria-hidden="true" className="size-4 shrink-0 text-blue-600" />{store.settings.deliveryEnabled ? "Delivery available" : "Pickup available"}</span></div>
        </div>

        {product.specifications.length ? (
          <div className="mt-8 border-t pt-6">
            <h2 className="font-semibold">Product details</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {product.specifications.map((specification) => (
                <div key={specification.name}>
                  <dt className="text-muted-foreground">{specification.name}</dt>
                  <dd className="mt-1 font-medium">{specification.value}{specification.unit ? ` ${specification.unit}` : ""}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        <div className="mt-8 border-t pt-5 text-xs text-muted-foreground">
          <p>Prices and availability are verified at checkout.</p>
          {store.settings.deliveryEnabled ? <p className="mt-1">Delivery pricing is based on the zone selected at checkout.</p> : null}
          {store.settings.pickupEnabled ? <p className="mt-1">Pickup available from {store.settings.pickupAddress}.</p> : null}
        </div>
      </section>
    </div>
  )
}

export function StorefrontCart({ store }: { store: PublicStorefront }) {
  const { cart, clear, remove, update } = useCart()
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<StorefrontCheckoutResult | null>(null)
  const [buyerName, setBuyerName] = useState("")
  const [buyerEmail, setBuyerEmail] = useState("")
  const [buyerPhone, setBuyerPhone] = useState("")
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">(store.settings.deliveryEnabled ? "delivery" : "pickup")
  const [deliveryZoneId, setDeliveryZoneId] = useState(store.settings.deliveryZones[0]?.id ?? "")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"pay_on_delivery" | "bank_transfer">(store.settings.payOnDeliveryEnabled ? "pay_on_delivery" : "bank_transfer")
  const [notes, setNotes] = useState("")
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const money = new Intl.NumberFormat("en", { currency: store.currencyCode, currencyDisplay: "narrowSymbol", style: "currency" })
  const subtotal = cart.reduce((total, item) => total + item.quantity * item.unitPrice, 0)
  const deliveryZone = store.settings.deliveryZones.find((zone) => zone.id === deliveryZoneId)
  const shipping = deliveryMethod === "pickup" ? 0 : deliveryZone?.deliveryFee ?? 0
  const total = subtotal + shipping

  async function submit() {
    const payload = { buyerEmail, buyerName, buyerPhone, deliveryAddress: deliveryMethod === "delivery" ? deliveryAddress : null, deliveryMethod, deliveryZoneId: deliveryMethod === "delivery" ? deliveryZoneId : null, idempotencyKey, items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity, variantId: item.variantId })), notes: notes.trim() || null, paymentMethod, slug: store.slug }
    const validation = storefrontCheckoutSchema.safeParse(payload)
    if (!validation.success) { toast.error(validation.error.issues[0]?.message ?? "Check your checkout details."); return }
    setPending(true)
    const response = await postJson<StorefrontCheckoutResult>("/api/storefront/checkout", validation.data)
    setPending(false)
    if (!response.ok) { toast.error(response.error.message); return }
    setResult(response.data)
    clear()
  }

  if (result) return <main className="bg-muted/15 px-4 py-16 sm:px-6 sm:py-24"><div className="mx-auto max-w-2xl rounded-[2rem] bg-card p-8 text-center shadow-xl ring-1 ring-foreground/8 sm:p-12"><span className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-500/10"><CheckCircle2 aria-hidden="true" className="size-10 text-emerald-600" /></span><p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Order confirmed</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Thank you for your order</h1><p className="mt-3 text-muted-foreground">Your order number is <strong className="text-foreground">{result.orderNumber}</strong>.</p><p className="mt-5 text-3xl font-semibold tracking-tight tabular-nums">{money.format(result.totalAmount)}</p>{result.paymentMethod === "bank_transfer" && result.bankTransferInstructions ? <div className="mt-7 whitespace-pre-wrap rounded-2xl bg-muted p-5 text-left text-sm"><strong className="mb-2 block">Bank transfer instructions</strong>{result.bankTransferInstructions}</div> : <p className="mt-5 text-sm text-muted-foreground">Pay when your order is delivered or collected.</p>}<ButtonLink className="mt-8 rounded-full px-5" href={`/store/${store.slug}`}>Continue shopping<ArrowRight aria-hidden="true" /></ButtonLink></div></main>

  if (!cart.length) return <main className="bg-muted/15 px-4 py-20 text-center sm:px-6 sm:py-28"><div className="mx-auto max-w-xl"><span className="mx-auto flex size-20 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-foreground/8"><ShoppingBag aria-hidden="true" className="size-9 text-muted-foreground/60" /></span><h1 className="mt-6 text-3xl font-semibold tracking-tight">Your cart is waiting</h1><p className="mt-3 text-muted-foreground">Browse the collection and add something you love.</p><ButtonLink className="mt-7 rounded-full px-5" href={`/store/${store.slug}`}>Explore products<ArrowRight aria-hidden="true" /></ButtonLink></div></main>

  return <main className="bg-muted/15"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1fr)_430px] lg:px-8">
    <section><div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: store.settings.primaryColor }}>Your order</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Shopping cart</h1><p className="mt-2 text-sm text-muted-foreground">{cart.length} {cart.length === 1 ? "item" : "items"} ready for checkout</p></div><button className="rounded-full px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive" onClick={clear} type="button">Clear cart</button></div><div className="mt-7 divide-y overflow-hidden rounded-[1.75rem] bg-card shadow-sm ring-1 ring-foreground/8">{cart.map((item) => { const key = itemKey(item); return <div className="flex gap-4 p-4 sm:p-5" key={key}><span className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-muted sm:size-24">{item.imageUrl ? <Image alt="" fill className="object-cover" sizes="96px" src={item.imageUrl} unoptimized /> : <Package aria-hidden="true" className="absolute inset-0 m-auto size-6 text-muted-foreground" />}</span><div className="min-w-0 flex-1"><p className="font-semibold">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.variantName ?? "Standard"} · {money.format(item.unitPrice)}</p><div className="mt-4 flex items-center gap-2"><Button aria-label="Decrease quantity" className="rounded-full" disabled={item.quantity <= 1} onClick={() => update(key, item.quantity - 1)} size="icon-sm" variant="outline"><Minus aria-hidden="true" /></Button><span className="w-8 text-center text-sm font-medium tabular-nums">{item.quantity}</span><Button aria-label="Increase quantity" className="rounded-full" disabled={item.maxStock !== null && item.quantity >= item.maxStock} onClick={() => update(key, item.quantity + 1)} size="icon-sm" variant="outline"><Plus aria-hidden="true" /></Button><Button aria-label={`Remove ${item.name}`} className="ml-auto rounded-full text-muted-foreground hover:text-destructive" onClick={() => remove(key)} size="icon-sm" variant="ghost"><Trash2 aria-hidden="true" /></Button></div></div><strong className="text-sm tabular-nums">{money.format(item.quantity * item.unitPrice)}</strong></div> })}</div></section>
    <aside className="rounded-[1.75rem] bg-card p-5 shadow-xl ring-1 ring-foreground/8 sm:p-6 lg:sticky lg:top-24"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-muted"><Truck aria-hidden="true" className="size-5" /></span><div><h2 className="text-lg font-semibold">Delivery and payment</h2><p className="text-xs text-muted-foreground">Complete your order details</p></div></div><div className="mt-6 grid gap-4"><label className="grid gap-2 text-sm font-medium">Full name<Input className="h-10" autoComplete="name" onChange={(event) => setBuyerName(event.currentTarget.value)} value={buyerName} /></label><label className="grid gap-2 text-sm font-medium">Email<Input className="h-10" autoComplete="email" onChange={(event) => setBuyerEmail(event.currentTarget.value)} type="email" value={buyerEmail} /></label><label className="grid gap-2 text-sm font-medium">Phone<Input className="h-10" autoComplete="tel" onChange={(event) => setBuyerPhone(event.currentTarget.value)} type="tel" value={buyerPhone} /></label>
      <fieldset><legend className="text-sm font-medium">Fulfilment</legend><div className="mt-2 grid grid-cols-2 gap-2">{store.settings.deliveryEnabled ? <label className="cursor-pointer rounded-xl border p-3 text-sm font-medium transition" style={deliveryMethod === "delivery" ? { backgroundColor: `color-mix(in srgb, ${store.settings.primaryColor} 8%, transparent)`, borderColor: store.settings.primaryColor } : undefined}><input checked={deliveryMethod === "delivery"} className="mr-2" name="delivery-method" onChange={() => setDeliveryMethod("delivery")} style={{ accentColor: store.settings.primaryColor }} type="radio" />Delivery</label> : null}{store.settings.pickupEnabled ? <label className="cursor-pointer rounded-xl border p-3 text-sm font-medium transition" style={deliveryMethod === "pickup" ? { backgroundColor: `color-mix(in srgb, ${store.settings.primaryColor} 8%, transparent)`, borderColor: store.settings.primaryColor } : undefined}><input checked={deliveryMethod === "pickup"} className="mr-2" name="delivery-method" onChange={() => setDeliveryMethod("pickup")} style={{ accentColor: store.settings.primaryColor }} type="radio" />Pickup</label> : null}</div></fieldset>
      {deliveryMethod === "delivery" ? <><fieldset><legend className="text-sm font-medium">Delivery zone</legend><div className="mt-2 grid gap-2">{store.settings.deliveryZones.map((zone) => <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3 text-sm transition" key={zone.id} style={deliveryZoneId === zone.id ? { backgroundColor: `color-mix(in srgb, ${store.settings.primaryColor} 8%, transparent)`, borderColor: store.settings.primaryColor } : undefined}><span><input checked={deliveryZoneId === zone.id} className="mr-2" name="delivery-zone" onChange={() => setDeliveryZoneId(zone.id)} style={{ accentColor: store.settings.primaryColor }} type="radio" /><strong>{zone.name}</strong>{zone.coverageDetails ? <span className="mt-1 block pl-5 text-xs font-normal text-muted-foreground">{zone.coverageDetails}</span> : null}</span><span className="shrink-0 font-medium">{zone.deliveryFee ? money.format(zone.deliveryFee) : "Free"}</span></label>)}</div></fieldset><label className="grid gap-2 text-sm font-medium">Delivery address<Textarea autoComplete="street-address" onChange={(event) => setDeliveryAddress(event.currentTarget.value)} value={deliveryAddress} /></label></> : <div className="rounded-xl bg-muted p-4 text-sm"><strong className="block">Pickup from</strong>{store.settings.pickupAddress}</div>}
      <fieldset><legend className="text-sm font-medium">Payment</legend><div className="mt-2 grid gap-2">{store.settings.payOnDeliveryEnabled ? <label className="cursor-pointer rounded-xl border p-3 text-sm transition" style={paymentMethod === "pay_on_delivery" ? { backgroundColor: `color-mix(in srgb, ${store.settings.primaryColor} 8%, transparent)`, borderColor: store.settings.primaryColor } : undefined}><input checked={paymentMethod === "pay_on_delivery"} className="mr-2" name="payment-method" onChange={() => setPaymentMethod("pay_on_delivery")} style={{ accentColor: store.settings.primaryColor }} type="radio" />Pay on delivery or pickup</label> : null}{store.settings.bankTransferEnabled ? <label className="cursor-pointer rounded-xl border p-3 text-sm transition" style={paymentMethod === "bank_transfer" ? { backgroundColor: `color-mix(in srgb, ${store.settings.primaryColor} 8%, transparent)`, borderColor: store.settings.primaryColor } : undefined}><input checked={paymentMethod === "bank_transfer"} className="mr-2" name="payment-method" onChange={() => setPaymentMethod("bank_transfer")} style={{ accentColor: store.settings.primaryColor }} type="radio" />Bank transfer</label> : null}</div></fieldset>
      <label className="grid gap-2 text-sm font-medium">Order note <span className="font-normal text-muted-foreground">(optional)</span><Textarea maxLength={500} onChange={(event) => setNotes(event.currentTarget.value)} value={notes} /></label>
    </div><div className="mt-6 space-y-2 border-t pt-5 text-sm"><div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{money.format(subtotal)}</span></div><div className="flex justify-between text-muted-foreground"><span>{deliveryMethod === "pickup" ? "Pickup" : deliveryZone?.name ?? "Delivery"}</span><span className="tabular-nums">{shipping ? money.format(shipping) : "Free"}</span></div><div className="flex justify-between pt-3 text-xl font-semibold"><span>Total</span><span className="tabular-nums">{money.format(total)}</span></div></div><Button className="mt-5 h-12 w-full rounded-full text-white shadow-lg" disabled={pending} onClick={submit} size="lg" style={{ backgroundColor: pending ? undefined : store.settings.primaryColor }}>{pending ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Placing order…</> : <>Place order<ArrowRight aria-hidden="true" /></>}</Button><p className="mt-3 text-center text-xs text-muted-foreground">Prices and availability are verified when you place the order.</p></aside>
  </div></main>
}
