"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CircleCheck, LoaderCircle } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { postJson } from "@/lib/api/client"
import {
  invoicePaymentMethods,
  type InvoicePaymentMethod,
} from "./schemas"
import type { MarkInvoicePaidData } from "./types"

const paymentMethodOptions: Array<{
  label: string
  value: InvoicePaymentMethod
}> = [
  { label: "Cash", value: "cash" },
  { label: "Bank transfer", value: "bank_transfer" },
  { label: "POS", value: "pos" },
  { label: "Card", value: "card" },
  { label: "Other", value: "other" },
]

type MarkInvoicePaidButtonProps = {
  currentPaymentMethod: string
  invoiceId: string
  invoiceNumber: string
}

function getInitialPaymentMethod(value: string): InvoicePaymentMethod {
  const normalizedValue = value.trim().toLowerCase().replaceAll(" ", "_")

  return invoicePaymentMethods.find((method) => method === normalizedValue) ?? "cash"
}

export function MarkInvoicePaidButton({
  currentPaymentMethod,
  invoiceId,
  invoiceNumber,
}: MarkInvoicePaidButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<InvoicePaymentMethod>(() =>
    getInitialPaymentMethod(currentPaymentMethod),
  )

  async function markPaid() {
    if (pending) return
    setPending(true)
    const response = await postJson<MarkInvoicePaidData>(
      `/api/invoices/${invoiceId}/mark-paid`,
      { paymentMethod },
    )
    setPending(false)

    if (!response.ok) {
      toast.error(response.error.message)
      return
    }

    setOpen(false)
    toast.success(response.message ?? `Invoice ${invoiceNumber} marked as paid.`)
    router.refresh()
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button"><CircleCheck aria-hidden="true" />Mark as paid</Button>
      <Dialog onOpenChange={(nextOpen) => { if (!pending) setOpen(nextOpen) }} open={open}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark invoice as paid?</DialogTitle>
            <DialogDescription>
              This will complete {invoiceNumber} and deduct its tracked catalogue items from inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="invoice-payment-method">
              Payment method
            </label>
            <Select
              disabled={pending}
              onValueChange={(value) => {
                if (invoicePaymentMethods.some((method) => method === value)) {
                  setPaymentMethod(value as InvoicePaymentMethod)
                }
              }}
              value={paymentMethod}
            >
              <SelectTrigger className="w-full" id="invoice-payment-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {paymentMethodOptions.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select the method used to receive this payment.
            </p>
          </div>
          <DialogFooter>
            <Button disabled={pending} onClick={() => setOpen(false)} type="button" variant="outline">Cancel</Button>
            <Button disabled={pending} onClick={markPaid} type="button">{pending ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Updating…</> : <><CircleCheck aria-hidden="true" />Confirm payment</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
