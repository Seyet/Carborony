"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Banknote,
  Building2,
  CreditCard,
  FilePlus2,
  LoaderCircle,
  Minus,
  PackageSearch,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  WalletCards,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button, ButtonLink } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { postJson } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import { downloadTransactionDocument } from "../documents/download-transaction-document"
import type {
  CompleteSaleData,
  CreateInvoiceData,
  PosCatalog,
  PosProduct,
  PosVariant,
} from "./types"

const paymentMethods = [
  { icon: Banknote, label: "Cash", value: "cash" },
  { icon: Building2, label: "Bank transfer", value: "bank_transfer" },
  { icon: WalletCards, label: "POS", value: "pos" },
  { icon: CreditCard, label: "Card", value: "card" },
  { icon: WalletCards, label: "Other", value: "other" },
] as const

type PaymentMethod = (typeof paymentMethods)[number]["value"]

type CartItem = {
  availableStock: number | null
  key: string
  name: string
  productId: string | null
  quantity: number
  sku: string | null
  source: "catalogue" | "external"
  unitPrice: number
  variantId: string | null
  variantName: string | null
}

function createCartItem(product: PosProduct, variant?: PosVariant): CartItem {
  const availableStock = variant?.stock ?? product.stock
  return {
    availableStock,
    key: `${product.id}:${variant?.id ?? "base"}`,
    name: product.name,
    productId: product.id,
    quantity: availableStock !== null ? Math.min(1, availableStock) : 1,
    sku: variant?.sku ?? product.sku,
    source: "catalogue",
    unitPrice: variant?.sellingPrice ?? product.sellingPrice,
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? null,
  }
}

type ExternalProductDraft = {
  name: string
  quantity: string
  sku: string
  unitPrice: string
}

const emptyExternalProduct: ExternalProductDraft = {
  name: "",
  quantity: "1",
  sku: "",
  unitPrice: "",
}

export function PosWorkspace({ catalog }: { catalog: PosCatalog }) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [variantProduct, setVariantProduct] = useState<PosProduct | null>(null)
  const [externalProductOpen, setExternalProductOpen] = useState(false)
  const [externalProduct, setExternalProduct] = useState(emptyExternalProduct)
  const [customerId, setCustomerId] = useState("")
  const [buyerName, setBuyerName] = useState("")
  const [buyerPhone, setBuyerPhone] = useState("")
  const [discountInput, setDiscountInput] = useState("0")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")
  const [pendingAction, setPendingAction] = useState<"invoice" | "sale" | null>(null)

  const money = useMemo(() => new Intl.NumberFormat("en", {
    currency: catalog.currencyCode,
    currencyDisplay: "narrowSymbol",
    style: "currency",
  }), [catalog.currencyCode])

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return catalog.products
    return catalog.products.filter((product) =>
      [product.name, product.sku, ...product.variants.flatMap((variant) => [variant.name, variant.sku])]
        .some((value) => value?.toLocaleLowerCase().includes(query)),
    )
  }, [catalog.products, search])

  const subtotal = cart.reduce((total, item) => total + item.quantity * item.unitPrice, 0)
  const parsedDiscount = discountInput.trim() === "" ? 0 : Number(discountInput)
  const discountIsValid = Number.isFinite(parsedDiscount)
    && parsedDiscount >= 0 && parsedDiscount <= subtotal
  const total = discountIsValid ? subtotal - parsedDiscount : subtotal
  const trimmedBuyerName = buyerName.trim()
  const trimmedBuyerPhone = buyerPhone.trim()
  const buyerNameIsValid = !trimmedBuyerName
    || (trimmedBuyerName.length >= 2 && trimmedBuyerName.length <= 160)
  const buyerPhoneIsValid = !trimmedBuyerPhone
    || (
      trimmedBuyerPhone.length >= 7
      && trimmedBuyerPhone.length <= 32
      && /^[0-9+(). -]+$/.test(trimmedBuyerPhone)
    )
  const buyerDetailsAreValid = buyerNameIsValid && buyerPhoneIsValid
  const externalQuantity = Number(externalProduct.quantity)
  const externalUnitPrice = Number(externalProduct.unitPrice)
  const externalProductIsValid = externalProduct.name.trim().length >= 1
    && externalProduct.name.trim().length <= 160
    && externalProduct.sku.trim().length <= 80
    && externalProduct.unitPrice.trim() !== ""
    && Number.isFinite(externalQuantity)
    && externalQuantity > 0
    && externalQuantity <= 10_000
    && Number.isInteger(externalQuantity * 1000)
    && Number.isFinite(externalUnitPrice)
    && externalUnitPrice >= 0
    && externalUnitPrice <= 999_999_999_999
    && Number.isInteger(externalUnitPrice * 10_000)

  function addItem(product: PosProduct, variant?: PosVariant) {
    const nextItem = createCartItem(product, variant)
    if (nextItem.availableStock !== null && nextItem.availableStock <= 0) {
      toast.error(`${variant?.name ?? product.name} is out of stock.`)
      return
    }
    setCart((current) => {
      const existing = current.find((item) => item.key === nextItem.key)
      if (existing && existing.availableStock !== null
        && existing.quantity + 1 > existing.availableStock) {
        toast.error(`Only ${existing.availableStock} units are available.`)
        return current
      }
      return existing
        ? current.map((item) => item.key === nextItem.key
            ? { ...item, quantity: item.quantity + 1 }
            : item)
        : [...current, nextItem]
    })
    setVariantProduct(null)
  }

  function addExternalProduct() {
    if (!externalProductIsValid) return

    setCart((current) => [...current, {
      availableStock: null,
      key: `external:${crypto.randomUUID()}`,
      name: externalProduct.name.trim(),
      productId: null,
      quantity: externalQuantity,
      sku: externalProduct.sku.trim() || null,
      source: "external",
      unitPrice: externalUnitPrice,
      variantId: null,
      variantName: null,
    }])
    setExternalProduct(emptyExternalProduct)
    setExternalProductOpen(false)
  }

  function updateExternalProduct(
    field: keyof ExternalProductDraft,
    value: string,
  ) {
    setExternalProduct((current) => ({ ...current, [field]: value }))
  }

  function selectProduct(product: PosProduct) {
    if (product.variants.length) setVariantProduct(product)
    else addItem(product)
  }

  function selectCustomer(id: string) {
    setCustomerId(id)
    const customer = catalog.customers.find((candidate) => candidate.id === id)
    setBuyerName(customer?.name ?? "")
    setBuyerPhone(customer?.phone ?? "")
  }

  function updateQuantity(key: string, quantity: number) {
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10_000) return
    setCart((current) => current.map((item) => {
      if (item.key !== key) return item
      if (item.availableStock !== null && quantity > item.availableStock) {
        toast.error(`Only ${item.availableStock} units are available.`)
        return item
      }
      return { ...item, quantity }
    }))
  }

  function transactionItems() {
    return cart.map((item) => item.source === "catalogue"
      ? {
          productId: item.productId,
          quantity: item.quantity,
          source: item.source,
          variantId: item.variantId,
        }
      : {
          name: item.name,
          quantity: item.quantity,
          sku: item.sku,
          source: item.source,
          unitPrice: item.unitPrice,
        })
  }

  function resetTransaction() {
    setCart([])
    setCustomerId("")
    setBuyerName("")
    setBuyerPhone("")
    setDiscountInput("0")
    setPaymentMethod("cash")
  }

  async function completeSale() {
    if (pendingAction || !cart.length || !discountIsValid || !buyerDetailsAreValid) return
    setPendingAction("sale")
    const response = await postJson<CompleteSaleData>("/api/sales", {
      buyerName: trimmedBuyerName || null,
      buyerPhone: trimmedBuyerPhone || null,
      customerId: customerId || null,
      discountAmount: parsedDiscount,
      items: transactionItems(),
      paymentMethod,
    })

    if (!response.ok) {
      setPendingAction(null)
      toast.error(response.error.message)
      return
    }

    resetTransaction()
    toast.success(response.message ?? "Sale completed successfully.", {
      description: `${response.data.saleNumber} · ${money.format(response.data.totalAmount)}`,
    })
    const download = await downloadTransactionDocument(
      "sale",
      response.data.saleId,
      response.data.saleNumber,
    )
    setPendingAction(null)
    if (!download.ok) toast.error(download.message)
    router.refresh()
  }

  async function createInvoice() {
    if (pendingAction || !cart.length || !discountIsValid || !buyerDetailsAreValid) return
    setPendingAction("invoice")
    const response = await postJson<CreateInvoiceData>("/api/invoices", {
      buyerName: trimmedBuyerName || null,
      buyerPhone: trimmedBuyerPhone || null,
      customerId: customerId || null,
      discountAmount: parsedDiscount,
      items: transactionItems(),
      paymentMethod,
    })

    if (!response.ok) {
      setPendingAction(null)
      toast.error(response.error.message)
      return
    }

    resetTransaction()
    toast.success(response.message ?? "Invoice created successfully.", {
      description: `${response.data.invoiceNumber} · ${money.format(response.data.totalAmount)}`,
    })
    const download = await downloadTransactionDocument(
      "invoice",
      response.data.invoiceId,
      response.data.invoiceNumber,
    )
    setPendingAction(null)
    if (!download.ok) toast.error(download.message)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Sales</span><span aria-hidden="true">/</span><span className="text-foreground">New sale</span>
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">New sale</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sell catalogue items, add an external item, or prepare an invoice.</p>
          </div>
          <div className="flex items-center gap-2">
            <ButtonLink href="/app/sales/history" variant="outline"><ReceiptText aria-hidden="true" />Sales history</ButtonLink>
            <Badge className="hidden sm:inline-flex" variant="secondary">POS workspace</Badge>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-11 bg-card pl-9" onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Search products, variants, or SKU…" type="search" value={search} />
            </div>
            <Button className="h-11" onClick={() => setExternalProductOpen(true)} type="button" variant="outline"><Plus aria-hidden="true" />Add external product</Button>
          </div>

          {filteredProducts.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product) => (
                <button
                  className="group flex min-h-36 flex-col rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  key={product.id}
                  onClick={() => selectProduct(product)}
                  type="button"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/8 text-primary"><ShoppingCart aria-hidden="true" className="size-4" /></span>
                  <span className="mt-4 line-clamp-2 font-medium">{product.name}</span>
                  <span className="mt-1 text-xs text-muted-foreground">{product.variants.length ? `${product.variants.length} variants` : product.sku || "No SKU"}</span>
                  <span className="mt-auto flex w-full items-end justify-between gap-2 pt-3">
                    <span className="font-semibold">{product.variants.length ? `From ${money.format(Math.min(...product.variants.map((variant) => variant.sellingPrice)))}` : money.format(product.sellingPrice)}</span>
                    <span className={cn("text-[11px]", product.stock !== null && product.stock <= 0 ? "text-destructive" : "text-muted-foreground")}>
                      {product.stock === null ? "Not tracked" : `${product.stock} in stock`}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 text-center">
              <PackageSearch aria-hidden="true" className="size-10 text-muted-foreground/60" />
              <h2 className="mt-4 font-semibold">{catalog.products.length ? "No matching products" : "No active products"}</h2>
              <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{catalog.products.length ? "Try another product name, variant, or SKU." : "Active catalogue products will appear here when they are added."}</p>
            </div>
          )}
        </section>

        <Card className="overflow-hidden py-0 shadow-sm xl:sticky xl:top-22">
          <CardHeader className="border-b py-5"><CardTitle className="flex items-center justify-between"><span>Current sale</span><Badge variant="secondary">{cart.length} {cart.length === 1 ? "item" : "items"}</Badge></CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[34vh] min-h-32 overflow-y-auto p-4 xl:max-h-72">
              {cart.length ? <div className="space-y-4">{cart.map((item) => (
                <div className="grid grid-cols-[1fr_auto] gap-3" key={item.key}>
                  <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-medium">{item.name}</p>{item.source === "external" ? <Badge className="shrink-0" variant="outline">External</Badge> : null}</div><p className="truncate text-xs text-muted-foreground">{item.variantName || item.sku || (item.source === "external" ? "Manual item" : "Standard")}</p>{item.availableStock !== null ? <p className="mt-1 text-xs text-muted-foreground">{item.availableStock} available</p> : null}<p className="mt-1 text-sm font-medium">{money.format(item.unitPrice)}</p></div>
                  <div className="flex flex-col items-end gap-2">
                    <button aria-label={`Remove ${item.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => setCart((current) => current.filter((line) => line.key !== item.key))} type="button"><Trash2 aria-hidden="true" className="size-4" /></button>
                    <div className="flex items-center rounded-lg border">
                      <button aria-label={`Decrease ${item.name} quantity`} className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground" onClick={() => updateQuantity(item.key, Math.max(0.001, item.quantity - 1))} type="button"><Minus aria-hidden="true" className="size-3.5" /></button>
                      <Input aria-label={`${item.name} quantity`} className="h-8 w-14 rounded-none border-y-0 px-1 text-center focus-visible:ring-0" max={item.availableStock ?? 10000} min={0.001} onChange={(event) => updateQuantity(item.key, Number(event.currentTarget.value))} step="0.001" type="number" value={item.quantity} />
                      <button aria-label={`Increase ${item.name} quantity`} className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40" disabled={item.availableStock !== null && item.quantity + 1 > item.availableStock} onClick={() => updateQuantity(item.key, item.quantity + 1)} type="button"><Plus aria-hidden="true" className="size-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}</div> : <div className="flex min-h-28 flex-col items-center justify-center text-center"><ShoppingCart aria-hidden="true" className="size-7 text-muted-foreground/50" /><p className="mt-2 text-sm font-medium">Your cart is empty</p><p className="mt-1 text-xs text-muted-foreground">Select a product to begin.</p></div>}
            </div>
            <Separator />
            <div className="space-y-4 p-4">
              <label className="grid gap-2 text-sm"><span className="flex items-center gap-2 font-medium"><UserRound aria-hidden="true" className="size-4" />Saved customer <span className="font-normal text-muted-foreground">(optional)</span></span><select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" onChange={(event) => selectCustomer(event.currentTarget.value)} value={customerId}><option value="">Walk-in customer</option>{catalog.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</select></label>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <label className="grid gap-2 text-sm"><span className="font-medium">Buyer name <span className="font-normal text-muted-foreground">(optional)</span></span><Input aria-invalid={!buyerNameIsValid || undefined} autoComplete="name" maxLength={160} onChange={(event) => setBuyerName(event.currentTarget.value)} placeholder="Buyer or company name" value={buyerName} />{!buyerNameIsValid ? <span className="text-xs text-destructive">Enter at least 2 characters.</span> : null}</label>
                <label className="grid gap-2 text-sm"><span className="font-medium">Buyer phone <span className="font-normal text-muted-foreground">(optional)</span></span><Input aria-invalid={!buyerPhoneIsValid || undefined} autoComplete="tel" inputMode="tel" maxLength={32} onChange={(event) => setBuyerPhone(event.currentTarget.value)} placeholder="e.g. +234 801 234 5678" type="tel" value={buyerPhone} />{!buyerPhoneIsValid ? <span className="text-xs text-destructive">Enter a valid phone number.</span> : null}</label>
              </div>
              <label className="grid gap-2 text-sm"><span className="font-medium">Discount amount</span><Input aria-invalid={!discountIsValid || undefined} inputMode="decimal" min="0" onChange={(event) => setDiscountInput(event.currentTarget.value)} placeholder="0.00" step="0.01" type="number" value={discountInput} />{!discountIsValid ? <span className="text-xs text-destructive">Discount must be between zero and the subtotal.</span> : null}</label>
              <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-medium">Payment method</legend><div className="grid grid-cols-3 gap-2">{paymentMethods.map((method) => { const Icon = method.icon; return <button aria-pressed={paymentMethod === method.value} className={cn("flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-2 text-center text-[11px] font-medium transition", paymentMethod === method.value ? "border-primary bg-primary/8 text-primary" : "text-muted-foreground hover:bg-muted")} key={method.value} onClick={() => setPaymentMethod(method.value)} type="button"><Icon aria-hidden="true" className="size-4" />{method.label}</button> })}</div></fieldset>
              <Separator />
              <div className="space-y-2 text-sm"><div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{money.format(subtotal)}</span></div><div className="flex justify-between text-muted-foreground"><span>Discount</span><span>-{money.format(discountIsValid ? parsedDiscount : 0)}</span></div><div className="flex justify-between pt-1 text-base font-semibold"><span>Total</span><span>{money.format(total)}</span></div></div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <Button className="w-full" disabled={!cart.length || !discountIsValid || !buyerDetailsAreValid || pendingAction !== null} onClick={createInvoice} size="lg" type="button" variant="outline">{pendingAction === "invoice" ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Creating invoice…</> : <><FilePlus2 aria-hidden="true" />Create invoice</>}</Button>
                <Button className="w-full" disabled={!cart.length || !discountIsValid || !buyerDetailsAreValid || pendingAction !== null} onClick={completeSale} size="lg" type="button">{pendingAction === "sale" ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Completing sale…</> : <>Complete transaction · {money.format(total)}</>}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog onOpenChange={(open) => { if (!open) setVariantProduct(null) }} open={Boolean(variantProduct)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Choose a variant</DialogTitle><DialogDescription>Select the option being sold for {variantProduct?.name}.</DialogDescription></DialogHeader>
          <div className="grid gap-2">{variantProduct?.variants.map((variant) => { const unavailable = variant.stock !== null && variant.stock <= 0; return <button className={cn("flex items-center justify-between rounded-xl border p-3 text-left transition", unavailable ? "cursor-not-allowed bg-muted/40 opacity-60" : "hover:border-primary/40 hover:bg-muted/50")} disabled={unavailable} key={variant.id} onClick={() => addItem(variantProduct, variant)} type="button"><span><span className="block text-sm font-medium">{variant.name}</span><span className="block text-xs text-muted-foreground">{variant.sku || "No SKU"}</span><span className={cn("mt-1 block text-xs", unavailable ? "text-destructive" : "text-muted-foreground")}>{variant.stock === null ? "Stock not tracked" : unavailable ? "Out of stock" : `${variant.stock} available`}</span></span><span className="font-semibold">{money.format(variant.sellingPrice)}</span></button> })}</div>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => { setExternalProductOpen(open); if (!open) setExternalProduct(emptyExternalProduct) }} open={externalProductOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add external product</DialogTitle><DialogDescription>Add an item to this transaction without saving it to the catalogue.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-1">
            <label className="grid gap-2 text-sm"><span className="font-medium">Product name <span className="text-destructive">*</span></span><Input autoFocus maxLength={160} onChange={(event) => updateExternalProduct("name", event.currentTarget.value)} placeholder="e.g. Custom delivery box" value={externalProduct.name} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm"><span className="font-medium">Unit price <span className="text-destructive">*</span></span><Input inputMode="decimal" min="0" onChange={(event) => updateExternalProduct("unitPrice", event.currentTarget.value)} placeholder="0.00" step="0.01" type="number" value={externalProduct.unitPrice} /></label>
              <label className="grid gap-2 text-sm"><span className="font-medium">Quantity <span className="text-destructive">*</span></span><Input inputMode="decimal" max="10000" min="0.001" onChange={(event) => updateExternalProduct("quantity", event.currentTarget.value)} step="0.001" type="number" value={externalProduct.quantity} /></label>
            </div>
            <label className="grid gap-2 text-sm"><span className="font-medium">SKU <span className="font-normal text-muted-foreground">(optional)</span></span><Input maxLength={80} onChange={(event) => updateExternalProduct("sku", event.currentTarget.value)} placeholder="External reference" value={externalProduct.sku} /></label>
          </div>
          <DialogFooter>
            <Button disabled={!externalProductIsValid} onClick={addExternalProduct} type="button"><Plus aria-hidden="true" />Add to transaction</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
