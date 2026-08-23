"use client"

import { useState } from "react"
import { Download, LoaderCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { downloadTransactionDocument } from "@/features/sales/documents/download-transaction-document"

type OrderReceiptButtonProps = {
  orderId: string
  orderNumber: string
}

export function OrderReceiptButton({ orderId, orderNumber }: OrderReceiptButtonProps) {
  const [pending, setPending] = useState(false)

  async function downloadReceipt() {
    if (pending) return
    setPending(true)
    const result = await downloadTransactionDocument("order", orderId, orderNumber)
    setPending(false)

    if (!result.ok) {
      toast.error(result.message)
      return
    }

    toast.success("Order receipt downloaded successfully.")
  }

  return (
    <Button
      aria-label={`Download receipt for order ${orderNumber}`}
      disabled={pending}
      onClick={downloadReceipt}
      type="button"
      variant="outline"
    >
      {pending
        ? <LoaderCircle aria-hidden="true" className="animate-spin" />
        : <Download aria-hidden="true" />}
      Download receipt
    </Button>
  )
}
