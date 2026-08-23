"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, LoaderCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { postJson } from "@/lib/api/client"
import { allowedOrderTransitions, orderStatusLabels } from "./order-status"
import type { OrderStatus, UpdateOrderStatusData } from "./types"

export function OrderStatusActions({ orderId, orderNumber, status }: { orderId: string; orderNumber: string; status: OrderStatus }) {
  const router = useRouter()
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | null>(null)
  const [note, setNote] = useState("")
  const [pending, setPending] = useState(false)
  const transitions = allowedOrderTransitions(status)

  async function updateStatus() {
    if (!selectedStatus || pending || note.length > 500) return
    setPending(true)
    const response = await postJson<UpdateOrderStatusData>(`/api/orders/${orderId}/status`, {
      note: note.trim() || null,
      status: selectedStatus,
    })
    setPending(false)
    if (!response.ok) {
      toast.error(response.error.message)
      return
    }
    toast.success(response.message ?? "Order status updated.")
    setSelectedStatus(null)
    setNote("")
    router.refresh()
  }

  if (!transitions.length) return null

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {transitions.map((nextStatus, index) => (
          <Button key={nextStatus} onClick={() => setSelectedStatus(nextStatus)} type="button" variant={index === 0 ? "default" : nextStatus === "cancelled" || nextStatus === "refunded" ? "destructive" : "outline"}>
            {orderStatusLabels[nextStatus]}<ArrowRight aria-hidden="true" />
          </Button>
        ))}
      </div>
      <Dialog onOpenChange={(open) => { if (!open && !pending) { setSelectedStatus(null); setNote("") } }} open={Boolean(selectedStatus)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{selectedStatus ? `Mark as ${orderStatusLabels[selectedStatus].toLowerCase()}?` : "Update order"}</DialogTitle><DialogDescription>This will move {orderNumber} from {orderStatusLabels[status].toLowerCase()} to {selectedStatus ? orderStatusLabels[selectedStatus].toLowerCase() : "the selected status"}.</DialogDescription></DialogHeader>
          <label className="grid gap-2 text-sm font-medium">Status note <span className="font-normal text-muted-foreground">(optional)</span><Textarea aria-invalid={note.length > 500 || undefined} maxLength={501} onChange={(event) => setNote(event.currentTarget.value)} placeholder="Add context for this status change" value={note} />{note.length > 500 ? <span className="text-xs text-destructive">Status notes must be 500 characters or fewer.</span> : <span className="text-right text-xs text-muted-foreground">{note.length}/500</span>}</label>
          <DialogFooter><Button disabled={pending} onClick={() => setSelectedStatus(null)} type="button" variant="outline">Cancel</Button><Button disabled={pending || note.length > 500} onClick={updateStatus} type="button" variant={selectedStatus === "cancelled" || selectedStatus === "refunded" ? "destructive" : "default"}>{pending ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Updating…</> : "Confirm status"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

