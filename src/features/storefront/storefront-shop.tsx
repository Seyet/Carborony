"use client"

import Image from "next/image"
import Link from "next/link"
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { CheckCircle2, LoaderCircle, Minus, Package, Plus, ShoppingBag, ShoppingCart, Store, Trash2 } from "lucide-react"
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
        imageUrl: product.imageUrls[0] ?? null,
        maxStock: product.trackInventory ? (variant?.stockQuantity ?? product.availableStock ?? 0) : null,
        name: product.name,
        productId: product.id,
        quantity: 1,
        unitPrice: variant?.sellingPrice ?? product.discountPrice ?? product.sellingPrice,
        variantId: variant?.id ?? null,
        variantName: variant?.name ?? null,
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
    {preview ? <div className="bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-950">Storefront preview — customers cannot see this draft.</div> : null}
    {store.settings.announcement ? <div className="px-4 py-2 text-center text-xs font-medium text-white" style={{ backgroundColor: store.settings.primaryColor }}>{store.settings.announcement}</div> : null}
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link className="flex min-w-0 items-center gap-2 font-semibold" href={`/store/${store.slug}${previewSuffix}`}>
          {store.logoUrl ? <span className="relative size-9 overflow-hidden rounded-lg"><Image alt={`${store.businessName} logo`} fill className="object-cover" sizes="36px" src={store.logoUrl} unoptimized /></span> : <span className="flex size-9 items-center justify-center rounded-lg text-white" style={{ backgroundColor: store.settings.primaryColor }}><Store aria-hidden="true" className="size-4" /></span>}
          <span className="truncate">{store.businessName}</span>
        </Link>
        <nav className="ml-auto flex items-center gap-2 text-sm"><Link className="rounded-lg px-3 py-2 hover:bg-muted" href={`/store/${store.slug}${previewSuffix}`}>Shop</Link><Link aria-label={`Cart with ${count} items`} className="relative flex size-10 items-center justify-center rounded-lg hover:bg-muted" href={`/store/${store.slug}/cart${previewSuffix}`}><ShoppingBag aria-hidden="true" className="size-5" />{count ? <span className="absolute top-0 right-0 flex min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ backgroundColor: store.settings.primaryColor }}>{count}</span> : null}</Link></nav>
      </div>
    </header>
  </>
}

export function StorefrontShell({ children, preview = false, store }: { children: ReactNode; preview?: boolean; store: PublicStorefront }) {
  return <CartProvider slug={store.slug}>
    <div className="min-h-screen bg-background text-foreground" style={{ "--store-color": store.settings.primaryColor } as React.CSSProperties}>
      <StoreHeader preview={preview} store={store} />
      {children}
      <footer className="mt-20 border-t bg-muted/30"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><div><p className="font-semibold text-foreground">{store.businessName}</p><p>Secure ordering powered by Carborony.</p></div><div className="flex flex-col sm:items-end">{store.settings.contactEmail ? <a href={`mailto:${store.settings.contactEmail}`}>{store.settings.contactEmail}</a> : null}{store.settings.contactPhone ? <a href={`tel:${store.settings.contactPhone}`}>{store.settings.contactPhone}</a> : null}</div></div></footer>
    </div>
  </CartProvider>
}

export function ProductCard({ preview = false, product, store }: { preview?: boolean; product: StorefrontProduct; store: PublicStorefront }) {
  const { add } = useCart()
  const outOfStock = product.trackInventory && (product.variants.length ? product.variants.every((variant) => variant.stockQuantity <= 0) : (product.availableStock ?? 0) <= 0)
  const price = product.discountPrice ?? product.sellingPrice
  const money = new Intl.NumberFormat("en", { currency: store.currencyCode, currencyDisplay: "narrowSymbol", style: "currency" })
  const href = `/store/${store.slug}/products/${product.id}${preview ? "?preview=1" : ""}`
  return <article className="group overflow-hidden rounded-2xl border bg-card shadow-xs transition hover:-translate-y-0.5 hover:shadow-md">
    <Link className="relative block aspect-square overflow-hidden bg-muted" href={href}>{product.imageUrls[0] ? <Image alt={product.name} fill className="object-cover transition duration-300 group-hover:scale-105" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" src={product.imageUrls[0]} unoptimized /> : <Package aria-hidden="true" className="absolute inset-0 m-auto size-10 text-muted-foreground/40" />}{outOfStock ? <span className="absolute top-3 left-3 rounded-full bg-background/90 px-2 py-1 text-xs font-medium">Sold out</span> : null}</Link>
    <div className="p-4"><p className="text-xs text-muted-foreground">{product.categoryName ?? "Shop"}</p><Link className="mt-1 block truncate font-semibold hover:underline" href={href}>{product.name}</Link><div className="mt-3 flex items-center justify-between gap-2"><p><strong>{money.format(price)}</strong>{product.discountPrice !== null ? <span className="ml-2 text-xs text-muted-foreground line-through">{money.format(product.sellingPrice)}</span> : null}</p>{product.variants.length ? <ButtonLink href={href} size="sm" variant="outline">Choose</ButtonLink> : <Button disabled={outOfStock} onClick={() => add(product)} size="sm"><Plus aria-hidden="true" />Add</Button>}</div></div>
  </article>
}

export function ProductPurchase({ product }: { product: StorefrontProduct }) {
  const { add } = useCart()
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "")
  const variant = product.variants.find((item) => item.id === variantId)
  const available = product.trackInventory ? (variant?.stockQuantity ?? product.availableStock ?? 0) : null
  return <div className="space-y-4">
    {product.variants.length ? <label className="grid gap-2 text-sm font-medium">Option<select className="h-11 rounded-lg border bg-background px-3" onChange={(event) => setVariantId(event.currentTarget.value)} value={variantId}>{product.variants.map((item) => <option disabled={product.trackInventory && item.stockQuantity <= 0} key={item.id} value={item.id}>{item.name}{product.trackInventory && item.stockQuantity <= 0 ? " — sold out" : ""}</option>)}</select></label> : null}
    <Button className="w-full" disabled={available !== null && available <= 0} onClick={() => add(product, variant)} size="lg"><ShoppingCart aria-hidden="true" />{available !== null && available <= 0 ? "Sold out" : "Add to cart"}</Button>
    {available !== null && available > 0 && available <= 5 ? <p className="text-center text-xs text-amber-700">Only {available} left</p> : null}
  </div>
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

  if (result) return <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6"><div className="rounded-2xl border bg-card p-8 text-center shadow-sm"><CheckCircle2 aria-hidden="true" className="mx-auto size-12 text-emerald-600" /><h1 className="mt-5 text-2xl font-semibold">Order received</h1><p className="mt-2 text-muted-foreground">Your order number is <strong className="text-foreground">{result.orderNumber}</strong>.</p><p className="mt-4 text-2xl font-semibold">{money.format(result.totalAmount)}</p>{result.paymentMethod === "bank_transfer" && result.bankTransferInstructions ? <div className="mt-6 whitespace-pre-wrap rounded-xl bg-muted p-4 text-left text-sm"><strong className="mb-2 block">Bank transfer instructions</strong>{result.bankTransferInstructions}</div> : <p className="mt-4 text-sm text-muted-foreground">Pay when your order is delivered or collected.</p>}<ButtonLink className="mt-7" href={`/store/${store.slug}`}>Continue shopping</ButtonLink></div></main>

  if (!cart.length) return <main className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6"><ShoppingBag aria-hidden="true" className="mx-auto size-12 text-muted-foreground/50" /><h1 className="mt-5 text-2xl font-semibold">Your cart is empty</h1><p className="mt-2 text-muted-foreground">Browse the store to find something you love.</p><ButtonLink className="mt-6" href={`/store/${store.slug}`}>Start shopping</ButtonLink></main>

  return <main className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
    <section><div className="flex items-end justify-between"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Checkout</p><h1 className="mt-1 text-2xl font-semibold">Your cart</h1></div><button className="text-xs text-muted-foreground hover:text-destructive" onClick={clear} type="button">Clear cart</button></div><div className="mt-5 divide-y rounded-2xl border bg-card">{cart.map((item) => { const key = itemKey(item); return <div className="flex gap-4 p-4" key={key}><span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted">{item.imageUrl ? <Image alt="" fill className="object-cover" sizes="80px" src={item.imageUrl} unoptimized /> : <Package aria-hidden="true" className="absolute inset-0 m-auto size-6 text-muted-foreground" />}</span><div className="min-w-0 flex-1"><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.variantName ?? "Standard"} · {money.format(item.unitPrice)}</p><div className="mt-3 flex items-center gap-2"><Button aria-label="Decrease quantity" disabled={item.quantity <= 1} onClick={() => update(key, item.quantity - 1)} size="icon-sm" variant="outline"><Minus aria-hidden="true" /></Button><span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span><Button aria-label="Increase quantity" disabled={item.maxStock !== null && item.quantity >= item.maxStock} onClick={() => update(key, item.quantity + 1)} size="icon-sm" variant="outline"><Plus aria-hidden="true" /></Button><Button aria-label={`Remove ${item.name}`} className="ml-auto" onClick={() => remove(key)} size="icon-sm" variant="ghost"><Trash2 aria-hidden="true" /></Button></div></div><strong className="text-sm">{money.format(item.quantity * item.unitPrice)}</strong></div> })}</div></section>
    <aside className="rounded-2xl border bg-card p-5 shadow-sm lg:sticky lg:top-24"><h2 className="text-lg font-semibold">Delivery and payment</h2><div className="mt-5 grid gap-4"><label className="grid gap-2 text-sm font-medium">Full name<Input autoComplete="name" onChange={(event) => setBuyerName(event.currentTarget.value)} value={buyerName} /></label><label className="grid gap-2 text-sm font-medium">Email<Input autoComplete="email" onChange={(event) => setBuyerEmail(event.currentTarget.value)} type="email" value={buyerEmail} /></label><label className="grid gap-2 text-sm font-medium">Phone<Input autoComplete="tel" onChange={(event) => setBuyerPhone(event.currentTarget.value)} type="tel" value={buyerPhone} /></label>
      <fieldset><legend className="text-sm font-medium">Fulfilment</legend><div className="mt-2 grid grid-cols-2 gap-2">{store.settings.deliveryEnabled ? <label className="rounded-lg border p-3 text-sm"><input checked={deliveryMethod === "delivery"} className="mr-2" name="delivery-method" onChange={() => setDeliveryMethod("delivery")} type="radio" />Delivery</label> : null}{store.settings.pickupEnabled ? <label className="rounded-lg border p-3 text-sm"><input checked={deliveryMethod === "pickup"} className="mr-2" name="delivery-method" onChange={() => setDeliveryMethod("pickup")} type="radio" />Pickup</label> : null}</div></fieldset>
      {deliveryMethod === "delivery" ? <><fieldset><legend className="text-sm font-medium">Delivery zone</legend><div className="mt-2 grid gap-2">{store.settings.deliveryZones.map((zone) => <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3 text-sm" key={zone.id}><span><input checked={deliveryZoneId === zone.id} className="mr-2" name="delivery-zone" onChange={() => setDeliveryZoneId(zone.id)} type="radio" /><strong>{zone.name}</strong>{zone.coverageDetails ? <span className="mt-1 block pl-5 text-xs font-normal text-muted-foreground">{zone.coverageDetails}</span> : null}</span><span className="shrink-0 font-medium">{zone.deliveryFee ? money.format(zone.deliveryFee) : "Free"}</span></label>)}</div></fieldset><label className="grid gap-2 text-sm font-medium">Delivery address<Textarea autoComplete="street-address" onChange={(event) => setDeliveryAddress(event.currentTarget.value)} value={deliveryAddress} /></label></> : <div className="rounded-lg bg-muted p-3 text-sm"><strong className="block">Pickup from</strong>{store.settings.pickupAddress}</div>}
      <fieldset><legend className="text-sm font-medium">Payment</legend><div className="mt-2 grid gap-2">{store.settings.payOnDeliveryEnabled ? <label className="rounded-lg border p-3 text-sm"><input checked={paymentMethod === "pay_on_delivery"} className="mr-2" name="payment-method" onChange={() => setPaymentMethod("pay_on_delivery")} type="radio" />Pay on delivery or pickup</label> : null}{store.settings.bankTransferEnabled ? <label className="rounded-lg border p-3 text-sm"><input checked={paymentMethod === "bank_transfer"} className="mr-2" name="payment-method" onChange={() => setPaymentMethod("bank_transfer")} type="radio" />Bank transfer</label> : null}</div></fieldset>
      <label className="grid gap-2 text-sm font-medium">Order note <span className="font-normal text-muted-foreground">(optional)</span><Textarea maxLength={500} onChange={(event) => setNotes(event.currentTarget.value)} value={notes} /></label>
    </div><div className="mt-6 space-y-2 border-t pt-5 text-sm"><div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{money.format(subtotal)}</span></div><div className="flex justify-between text-muted-foreground"><span>{deliveryMethod === "pickup" ? "Pickup" : deliveryZone?.name ?? "Delivery"}</span><span>{shipping ? money.format(shipping) : "Free"}</span></div><div className="flex justify-between pt-2 text-lg font-semibold"><span>Total</span><span>{money.format(total)}</span></div></div><Button className="mt-5 w-full" disabled={pending} onClick={submit} size="lg">{pending ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Placing order…</> : "Place order"}</Button><p className="mt-3 text-center text-xs text-muted-foreground">Prices and availability are verified when you place the order.</p></aside>
  </main>
}
