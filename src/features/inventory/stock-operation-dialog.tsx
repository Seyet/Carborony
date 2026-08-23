"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { postJson } from "@/lib/api/client"
import type { InventoryOperationData } from "./api-types"
import { inventoryOperationSchema } from "./schemas"
import type { InventoryProduct } from "./types"

const operations = [
  { description: "Increase stock when new units arrive.", label: "Add stock", value: "add" },
  { description: "Remove units for a non-sale stock reduction.", label: "Remove stock", value: "remove" },
  { description: "Set stock to the exact quantity counted.", label: "Adjust stock", value: "adjust" },
  { description: "Record units that can no longer be sold.", label: "Damaged stock", value: "damage" },
  { description: "Return units back into available stock.", label: "Returned stock", value: "return" },
  { description: "Record missing or lost units.", label: "Lost stock", value: "loss" },
] as const

type Operation = (typeof operations)[number]["value"]

export function StockOperationDialog({ product }: { product: InventoryProduct }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [operation, setOperation] = useState<Operation>("add")
  const [quantity, setQuantity] = useState("")
  const [note, setNote] = useState("")
  const [variantId, setVariantId] = useState<string | null>(product.variants[0]?.id ?? null)
  const selectedOperation = operations.find((item) => item.value === operation) ?? operations[0]
  const selectedVariant = product.variants.find((variant) => variant.id === variantId) ?? null
  const currentStock = selectedVariant?.stockQuantity ?? product.stockQuantity
  const parsedQuantity = quantity === "" ? Number.NaN : Number(quantity)
  const reducesStock = operation === "remove" || operation === "damage" || operation === "loss"
  const exceedsAvailableStock = reducesStock
    && Number.isFinite(parsedQuantity)
    && parsedQuantity > currentStock
  const validation = useMemo(() => inventoryOperationSchema.safeParse({
    note: note.trim() || null,
    operation,
    productId: product.id,
    quantity: parsedQuantity,
    variantId,
  }), [note, operation, parsedQuantity, product.id, variantId])
  const quantityError = quantity
    ? exceedsAvailableStock
      ? `Only ${currentStock.toLocaleString()} units are available.`
      : !validation.success
        ? validation.error.issues.find((issue) => issue.path[0] === "quantity")?.message
        : null
    : null
  const noteError = note.length > 500 ? "Notes must be 500 characters or fewer." : null
  const canSubmit = validation.success && !exceedsAvailableStock

  function reset() {
    setOperation("add")
    setQuantity("")
    setNote("")
    setVariantId(product.variants[0]?.id ?? null)
  }

  async function submit() {
    if (pending || !canSubmit || !validation.success) return
    setPending(true)
    const response = await postJson<InventoryOperationData>(
      "/api/inventory/adjustments",
      validation.data,
    )
    setPending(false)

    if (!response.ok) {
      toast.error(response.error.message)
      return
    }

    toast.success(response.message ?? "Stock updated successfully.")
    setOpen(false)
    reset()
    router.refresh()
  }

  return (
    <>
      <Button disabled={!product.trackInventory} onClick={() => setOpen(true)} size="sm" type="button" variant="outline">
        <SlidersHorizontal aria-hidden="true" />Manage stock
      </Button>
      <Dialog onOpenChange={(nextOpen) => { if (!pending) { setOpen(nextOpen); if (!nextOpen) reset() } }} open={open}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update {product.name}</DialogTitle>
            <DialogDescription>{selectedVariant ? `${selectedVariant.name} stock` : "Current stock"}: {currentStock.toLocaleString()}. Every operation is recorded in stock history.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {product.variants.length ? (
              <div className="grid gap-1.5">
                <label className="text-sm font-medium" htmlFor={`variant-${product.id}`}>Product variant</label>
                <Select
                  disabled={pending}
                  onValueChange={(value) => {
                    if (product.variants.some((variant) => variant.id === value)) {
                      setVariantId(value)
                      setQuantity("")
                    }
                  }}
                  value={variantId}
                >
                  <SelectTrigger className="w-full" id={`variant-${product.id}`}><SelectValue /></SelectTrigger>
                  <SelectContent align="start">
                    {product.variants.map((variant) => <SelectItem key={variant.id} value={variant.id}>{variant.name} · {variant.stockQuantity.toLocaleString()} in stock</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor={`operation-${product.id}`}>Operation</label>
              <Select
                disabled={pending}
                onValueChange={(value) => {
                  if (operations.some((item) => item.value === value)) setOperation(value as Operation)
                }}
                value={operation}
              >
                <SelectTrigger className="w-full" id={`operation-${product.id}`}><SelectValue /></SelectTrigger>
                <SelectContent align="start">
                  {operations.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{selectedOperation.description}</p>
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor={`quantity-${product.id}`}>
                {operation === "adjust" ? "New stock quantity" : "Quantity"}
              </label>
              <Input
                aria-invalid={Boolean(quantityError)}
                disabled={pending}
                id={`quantity-${product.id}`}
                inputMode="decimal"
                min="0"
                onChange={(event) => setQuantity(event.currentTarget.value)}
                placeholder={operation === "adjust" ? String(currentStock) : "0"}
                step="0.001"
                type="number"
                value={quantity}
              />
              {quantityError ? <p className="text-xs text-destructive" role="alert">{quantityError}</p> : null}
              {!quantityError && reducesStock ? <p className="text-xs text-muted-foreground">Maximum available: {currentStock.toLocaleString()}</p> : null}
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor={`note-${product.id}`}>Notes <span className="font-normal text-muted-foreground">(optional)</span></label>
              <Textarea
                aria-invalid={Boolean(noteError)}
                disabled={pending}
                id={`note-${product.id}`}
                maxLength={501}
                onChange={(event) => setNote(event.currentTarget.value)}
                placeholder="Add a reason or reference for this operation"
                value={note}
              />
              <div className="flex justify-between gap-3 text-xs">
                {noteError ? <p className="text-destructive" role="alert">{noteError}</p> : <span />}
                <span className="text-muted-foreground">{note.length}/500</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button disabled={pending} onClick={() => setOpen(false)} type="button" variant="outline">Cancel</Button>
            <Button disabled={pending || !canSubmit} onClick={submit} type="button">
              {pending ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Updating…</> : selectedOperation.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
