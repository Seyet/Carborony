"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button, ButtonLink } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import type { PosCatalog, PosProduct, PosVariant } from "@/features/sales/pos/types"
import { postJson } from "@/lib/api/client"
import { createManualOrderSchema } from "./schemas"
import type { CreateOrderData } from "./types"

type CartItem = {
  key: string
  name: string
  productId: string
  quantity: number
  sku: string | null
  unitPrice: number
  variantId: string | null
  variantName: string | null
}

function cartItem(product: PosProduct, variant?: PosVariant): CartItem {
  return {
    key: `${product.id}:${variant?.id ?? "base"}`,
    name: product.name,
    productId: product.id,
    quantity: 1,
    sku: variant?.sku ?? product.sku,
    unitPrice: variant?.sellingPrice ?? product.sellingPrice,
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? null,
  }
}

export function ManualOrderForm({ catalog }: { catalog: PosCatalog }) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedItem, setSelectedItem] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [buyerName, setBuyerName] = useState("")
  const [buyerPhone, setBuyerPhone] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [discount, setDiscount] = useState("0")
  const [shipping, setShipping] = useState("0")
  const [notes, setNotes] = useState("")
  const [pending, setPending] = useState(false)
  const money = useMemo(() => new Intl.NumberFormat("en", {
    currency: catalog.currencyCode,
    currencyDisplay: "narrowSymbol",
    style: "currency",
  }), [catalog.currencyCode])
  const subtotal = cart.reduce((total, item) => total + item.quantity * item.unitPrice, 0)
  const discountAmount = discount.trim() === "" ? Number.NaN : Number(discount)
  const shippingAmount = shipping.trim() === "" ? Number.NaN : Number(shipping)
  const buyerNameValid = !buyerName.trim() || buyerName.trim().length >= 2
  const buyerPhoneValid = !buyerPhone.trim() || (
    buyerPhone.trim().length >= 7
    && buyerPhone.trim().length <= 32
    && /^[0-9+(). -]+$/.test(buyerPhone.trim())
  )
  const deliveryAddressValid = deliveryAddress.trim().length >= 5
    && deliveryAddress.trim().length <= 500
  const discountValid = Number.isFinite(discountAmount) && discountAmount >= 0 && discountAmount <= subtotal
  const shippingValid = Number.isFinite(shippingAmount) && shippingAmount >= 0
  const total = subtotal - (discountValid ? discountAmount : 0) + (shippingValid ? shippingAmount : 0)
  const payload = {
    buyerName: buyerName.trim() || null,
    buyerPhone: buyerPhone.trim() || null,
    customerId: customerId || null,
    deliveryAddress: deliveryAddress.trim(),
    discountAmount,
    items: cart.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      source: "catalogue" as const,
      variantId: item.variantId,
    })),
    notes: notes.trim() || null,
    shippingAmount,
  }
  const validation = createManualOrderSchema.safeParse(payload)

  function addSelectedItem() {
    if (!selectedItem) return
    const [productId, variantId = ""] = selectedItem.split(":")
    const product = catalog.products.find((item) => item.id === productId)
    if (!product) return
    const variant = variantId ? product.variants.find((item) => item.id === variantId) : undefined
    if (product.variants.length && !variant) return
    const next = cartItem(product, variant)
    setCart((current) => {
      const existing = current.find((item) => item.key === next.key)
      return existing
        ? current.map((item) => item.key === next.key ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, next]
    })
    setSelectedItem("")
  }

  function updateQuantity(key: string, value: number) {
    if (!Number.isFinite(value) || value <= 0 || value > 10_000) return
    setCart((current) => current.map((item) => item.key === key ? { ...item, quantity: value } : item))
  }

  function selectCustomer(value: string) {
    setCustomerId(value)
    const customer = catalog.customers.find((item) => item.id === value)
    setBuyerName(customer?.name ?? "")
    setBuyerPhone(customer?.phone ?? "")
  }

  async function submit() {
    if (pending || !validation.success) return
    setPending(true)
    const response = await postJson<CreateOrderData>("/api/orders", validation.data)
    setPending(false)
    if (!response.ok) {
      toast.error(response.error.message)
      return
    }
    toast.success(response.message ?? "Order created successfully.", {
      description: `${response.data.orderNumber} · ${money.format(response.data.totalAmount)}`,
    })
    router.push(`/app/orders/${response.data.orderId}`)
    router.refresh()
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle as="h2">Order items</CardTitle><p className="text-sm text-muted-foreground">Choose catalogue products and variants for this order.</p></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <select className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm" onChange={(event) => setSelectedItem(event.currentTarget.value)} value={selectedItem}>
                <option value="">Select a product or variant</option>
                {catalog.products.flatMap((product) => product.variants.length
                  ? product.variants.map((variant) => <option key={`${product.id}:${variant.id}`} value={`${product.id}:${variant.id}`}>{product.name} · {variant.name} · {money.format(variant.sellingPrice)}</option>)
                  : [<option key={`${product.id}:base`} value={`${product.id}:`}>{product.name} · {money.format(product.sellingPrice)}</option>])}
              </select>
              <Button disabled={!selectedItem} onClick={addSelectedItem} type="button"><Plus aria-hidden="true" />Add item</Button>
            </div>

            {cart.length ? <div className="divide-y rounded-xl border">{cart.map((item) => (
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center" key={item.key}>
                <div className="min-w-0 flex-1"><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.variantName || item.sku || "Standard product"} · {money.format(item.unitPrice)} each</p></div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg border"><button aria-label={`Decrease ${item.name} quantity`} className="flex size-8 items-center justify-center text-muted-foreground" onClick={() => updateQuantity(item.key, Math.max(0.001, item.quantity - 1))} type="button"><Minus aria-hidden="true" className="size-3.5" /></button><Input aria-label={`${item.name} quantity`} className="h-8 w-16 rounded-none border-y-0 px-1 text-center" min="0.001" onChange={(event) => updateQuantity(item.key, Number(event.currentTarget.value))} step="0.001" type="number" value={item.quantity} /><button aria-label={`Increase ${item.name} quantity`} className="flex size-8 items-center justify-center text-muted-foreground" onClick={() => updateQuantity(item.key, item.quantity + 1)} type="button"><Plus aria-hidden="true" className="size-3.5" /></button></div>
                  <p className="w-24 text-right font-medium">{money.format(item.quantity * item.unitPrice)}</p>
                  <Button aria-label={`Remove ${item.name}`} onClick={() => setCart((current) => current.filter((line) => line.key !== item.key))} size="icon-sm" type="button" variant="ghost"><Trash2 aria-hidden="true" /></Button>
                </div>
              </div>
            ))}</div> : <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed text-center"><ShoppingCart aria-hidden="true" className="size-8 text-muted-foreground/60" /><p className="mt-3 font-medium">No items added</p><p className="mt-1 text-sm text-muted-foreground">Select a product above to begin.</p></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle as="h2">Buyer and delivery</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium sm:col-span-2">Saved customer <span className="font-normal text-muted-foreground">(optional)</span><select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" onChange={(event) => selectCustomer(event.currentTarget.value)} value={customerId}><option value="">No saved customer</option>{catalog.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-medium">Buyer name <span className="font-normal text-muted-foreground">(optional)</span><Input aria-invalid={!buyerNameValid || undefined} maxLength={160} onChange={(event) => setBuyerName(event.currentTarget.value)} value={buyerName} />{!buyerNameValid ? <span className="text-xs text-destructive">Enter at least 2 characters.</span> : null}</label>
            <label className="grid gap-2 text-sm font-medium">Buyer phone <span className="font-normal text-muted-foreground">(optional)</span><Input aria-invalid={!buyerPhoneValid || undefined} maxLength={32} onChange={(event) => setBuyerPhone(event.currentTarget.value)} type="tel" value={buyerPhone} />{!buyerPhoneValid ? <span className="text-xs text-destructive">Enter a valid phone number.</span> : null}</label>
            <label className="grid gap-2 text-sm font-medium sm:col-span-2">Delivery address<Textarea aria-invalid={!deliveryAddressValid || undefined} autoComplete="street-address" maxLength={500} onChange={(event) => setDeliveryAddress(event.currentTarget.value)} placeholder="Street, city, state, and delivery landmark" required value={deliveryAddress} />{deliveryAddress && !deliveryAddressValid ? <span className="text-xs text-destructive">Enter at least 5 characters.</span> : <span className="text-xs font-normal text-muted-foreground">Required for delivery and saved on this order.</span>}</label>
            <label className="grid gap-2 text-sm font-medium sm:col-span-2">Order notes <span className="font-normal text-muted-foreground">(optional)</span><Textarea maxLength={1000} onChange={(event) => setNotes(event.currentTarget.value)} placeholder="Delivery instructions or internal notes" value={notes} /></label>
          </CardContent>
        </Card>
      </div>

      <Card className="xl:sticky xl:top-22">
        <CardHeader><CardTitle className="flex items-center justify-between"><span>Order summary</span><Badge variant="secondary">{cart.length} {cart.length === 1 ? "item" : "items"}</Badge></CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="grid gap-2 text-sm font-medium">Discount<Input aria-invalid={!discountValid || undefined} min="0" onChange={(event) => setDiscount(event.currentTarget.value)} step="0.01" type="number" value={discount} />{!discountValid ? <span className="text-xs text-destructive">Discount cannot exceed the subtotal.</span> : null}</label>
          <label className="grid gap-2 text-sm font-medium">Shipping<Input aria-invalid={!shippingValid || undefined} min="0" onChange={(event) => setShipping(event.currentTarget.value)} step="0.01" type="number" value={shipping} />{!shippingValid ? <span className="text-xs text-destructive">Enter a valid shipping amount.</span> : null}</label>
          <Separator />
          <div className="space-y-2 text-sm"><div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{money.format(subtotal)}</span></div><div className="flex justify-between text-muted-foreground"><span>Discount</span><span>−{money.format(discountValid ? discountAmount : 0)}</span></div><div className="flex justify-between text-muted-foreground"><span>Shipping</span><span>{money.format(shippingValid ? shippingAmount : 0)}</span></div><div className="flex justify-between border-t pt-3 text-base font-semibold"><span>Total</span><span>{money.format(total)}</span></div></div>
          <div className="grid gap-2"><Button className="w-full" disabled={pending || !validation.success} onClick={submit} size="lg" type="button">{pending ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Creating order…</> : "Create order"}</Button><ButtonLink href="/app/orders" variant="outline">Cancel</ButtonLink></div>
        </CardContent>
      </Card>
    </div>
  )
}
