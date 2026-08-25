import Link from "next/link"
import { Eye, ShoppingBag } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { orderStatusClass, orderStatusLabels } from "./order-status"
import type { OrderListItem } from "./types"

function formatMoney(currencyCode: string, amount: number) {
  return new Intl.NumberFormat("en", { currency: currencyCode, currencyDisplay: "narrowSymbol", style: "currency" }).format(amount)
}

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value))
}

export function OrdersTable({ items, timezone }: { items: OrderListItem[]; timezone: string }) {
  return (
    <Card className="overflow-hidden py-0 shadow-sm">
      <CardHeader className="border-b py-5"><CardTitle as="h2">Orders</CardTitle><p className="text-sm text-muted-foreground">Orders from manual entry and connected sales channels.</p></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="pl-4 sm:pl-6">Order</TableHead><TableHead>Buyer</TableHead><TableHead>Channel</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Payment</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="pr-4 text-right sm:pr-6">Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="pl-4 sm:pl-6"><div className="flex min-w-44 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><ShoppingBag aria-hidden="true" className="size-4" /></span><span><Link className="block font-medium hover:underline" href={`/app/orders/${order.id}`}>{order.number}</Link><span className="block text-xs text-muted-foreground">{order.itemCount} {order.itemCount === 1 ? "item" : "items"}</span></span></div></TableCell>
                <TableCell><span className="block">{order.buyerName}</span>{order.buyerPhone ? <span className="block text-xs text-muted-foreground">{order.buyerPhone}</span> : null}</TableCell>
                <TableCell><Badge className="capitalize" variant="outline">{order.channel}</Badge></TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(order.placedAt, timezone)}</TableCell>
                <TableCell><Badge className={orderStatusClass(order.status)} variant="secondary">{orderStatusLabels[order.status]}</Badge></TableCell>
                <TableCell className="capitalize text-muted-foreground">{order.paymentStatus}</TableCell>
                <TableCell className="text-right font-medium">{formatMoney(order.currencyCode, order.totalAmount)}</TableCell>
                <TableCell className="pr-4 text-right sm:pr-6"><ButtonLink href={`/app/orders/${order.id}`} size="sm" variant="outline"><Eye aria-hidden="true" />View</ButtonLink></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
