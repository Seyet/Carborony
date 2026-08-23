import { CalendarDays, CircleDollarSign, History, ShoppingBag, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { orderStatusClass, orderStatusLabels } from "./order-status"
import type { OrderDetailsData, OrderStatus } from "./types"

const workflow: OrderStatus[] = ["pending", "confirmed", "processing", "ready", "completed"]

function formatMoney(currencyCode: string, amount: number) {
  return new Intl.NumberFormat("en", { currency: currencyCode, currencyDisplay: "narrowSymbol", style: "currency" }).format(amount)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(value))
}

export function OrderDetails({ order }: { order: OrderDetailsData }) {
  const money = (amount: number) => formatMoney(order.currencyCode, amount)
  const currentIndex = workflow.indexOf(order.status)
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle as="h2">Order progress</CardTitle></CardHeader>
        <CardContent>
          {order.status === "cancelled" || order.status === "refunded" ? <Badge className={orderStatusClass(order.status)} variant="secondary">{orderStatusLabels[order.status]}</Badge> : (
            <ol className="grid gap-3 sm:grid-cols-5">{workflow.map((status, index) => <li className="flex items-center gap-2 sm:flex-col sm:items-start" key={status}><span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${index <= currentIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{index + 1}</span><span className={index <= currentIndex ? "font-medium" : "text-muted-foreground"}>{orderStatusLabels[status]}</span></li>)}</ol>
          )}
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card className="overflow-hidden py-0">
            <CardHeader className="border-b py-5"><CardTitle as="h2">Order items</CardTitle></CardHeader>
            <CardContent className="p-0"><Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="pl-4 sm:pl-6">Item</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Unit price</TableHead><TableHead className="text-right">Discount</TableHead><TableHead className="pr-4 text-right sm:pr-6">Total</TableHead></TableRow></TableHeader><TableBody>{order.items.map((item) => <TableRow key={item.id}><TableCell className="pl-4 sm:pl-6"><span className="block font-medium">{item.name}</span><span className="block text-xs text-muted-foreground">{[item.variantName, item.sku, item.itemSource === "external" ? "External item" : null].filter(Boolean).join(" · ") || "Standard item"}</span></TableCell><TableCell className="text-right">{item.quantity}</TableCell><TableCell className="text-right">{money(item.unitPrice)}</TableCell><TableCell className="text-right text-muted-foreground">{money(item.discountAmount)}</TableCell><TableCell className="pr-4 text-right font-medium sm:pr-6">{money(item.lineTotal)}</TableCell></TableRow>)}</TableBody></Table></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle as="h2" className="flex items-center gap-2"><History aria-hidden="true" className="size-4" />Status history</CardTitle></CardHeader>
            <CardContent><ol className="space-y-4">{order.history.map((entry) => <li className="flex gap-3" key={entry.id}><span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" /><div><p className="text-sm"><span className="font-medium">{entry.previousStatus ? orderStatusLabels[entry.previousStatus as OrderStatus] : "Created"}</span>{entry.previousStatus ? " → " : " as "}<span className="font-medium">{orderStatusLabels[entry.newStatus as OrderStatus]}</span></p><p className="mt-1 text-xs text-muted-foreground">{formatDate(entry.createdAt)} · {entry.changedBy}</p>{entry.note ? <p className="mt-1 text-sm text-muted-foreground">{entry.note}</p> : null}</div></li>)}</ol></CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card><CardHeader><CardTitle>Buyer</CardTitle></CardHeader><CardContent className="flex items-start gap-3 text-sm"><UserRound aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" /><div><p className="font-medium">{order.buyerName}</p>{order.buyerPhone ? <p className="mt-1 text-muted-foreground">{order.buyerPhone}</p> : null}{order.buyerEmail ? <p className="mt-1 text-muted-foreground">{order.buyerEmail}</p> : null}</div></CardContent></Card>
          <Card><CardHeader><CardTitle>Delivery address</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm text-muted-foreground">{order.deliveryAddress ?? "No delivery address was recorded for this order."}</p></CardContent></Card>
          <Card><CardHeader><CardTitle>Order</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex items-center gap-3"><CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />{formatDate(order.placedAt)}</div><div className="flex items-center gap-3"><ShoppingBag aria-hidden="true" className="size-4 text-muted-foreground" /><span className="capitalize">{order.channel}</span></div><div className="flex items-center gap-3"><CircleDollarSign aria-hidden="true" className="size-4 text-muted-foreground" /><span className="capitalize">Payment: {order.paymentStatus}</span></div><div className="flex items-center justify-between border-t pt-3"><span className="text-muted-foreground">Status</span><Badge className={orderStatusClass(order.status)} variant="secondary">{orderStatusLabels[order.status]}</Badge></div></CardContent></Card>
          <Card><CardHeader><CardTitle>Summary</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{money(order.subtotalAmount)}</span></div><div className="flex justify-between text-muted-foreground"><span>Discount</span><span>−{money(order.discountAmount)}</span></div><div className="flex justify-between text-muted-foreground"><span>Shipping</span><span>{money(order.shippingAmount)}</span></div><div className="flex justify-between text-muted-foreground"><span>Tax</span><span>{money(order.taxAmount)}</span></div><div className="flex justify-between border-t pt-3 text-base font-semibold"><span>Total</span><span>{money(order.totalAmount)}</span></div></CardContent></Card>
          {order.notes ? <Card><CardHeader><CardTitle>Notes</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm text-muted-foreground">{order.notes}</p></CardContent></Card> : null}
        </div>
      </div>
    </div>
  )
}
