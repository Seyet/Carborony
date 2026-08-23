import { Building2, CalendarDays, CreditCard, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { TransactionDocumentData } from "../documents/types"

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(value))
}

function formatMoney(currencyCode: string, amount: number) {
  return new Intl.NumberFormat("en", {
    currency: currencyCode,
    currencyDisplay: "narrowSymbol",
    style: "currency",
  }).format(amount)
}

export function TransactionDetails({ data }: { data: TransactionDocumentData }) {
  const money = (amount: number) => formatMoney(data.currencyCode, amount)

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="overflow-hidden py-0 shadow-sm">
        <CardHeader className="border-b py-5">
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 sm:pl-6">Item</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="pr-4 text-right sm:pr-6">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item, index) => (
                <TableRow key={`${item.name}:${item.sku ?? index}`}>
                  <TableCell className="pl-4 sm:pl-6">
                    <span className="block font-medium">{item.name}</span>
                    <span className="block text-xs text-muted-foreground">{[item.variantName, item.sku, item.itemSource === "external" ? "External item" : null].filter(Boolean).join(" · ") || "Standard item"}</span>
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{money(item.unitPrice)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{money(item.discountAmount)}</TableCell>
                  <TableCell className="pr-4 text-right font-medium sm:pr-6">{money(item.lineTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Buyer</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-3"><UserRound aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" /><div><p className="font-medium">{data.customer?.name ?? "Walk-in customer"}</p>{data.customer?.phone ? <p className="mt-0.5 text-muted-foreground">{data.customer.phone}</p> : null}{data.customer?.email ? <p className="mt-0.5 text-muted-foreground">{data.customer.email}</p> : null}</div></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Transaction</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-3"><CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" /><span>{formatDate(data.issuedAt)}</span></div>
            <div className="flex items-start gap-3"><CreditCard aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" /><div><p className="capitalize">{data.paymentMethod}</p><p className="mt-0.5 text-xs capitalize text-muted-foreground">Payment status: {data.paymentStatus ?? "Not available"}</p></div></div>
            <div className="flex items-center gap-3"><Building2 aria-hidden="true" className="size-4 text-muted-foreground" /><span>{data.business.name}</span></div>
            <div className="flex items-center justify-between border-t pt-3"><span className="text-muted-foreground">Status</span><Badge className="capitalize" variant="secondary">{data.status}</Badge></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{money(data.subtotalAmount)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>-{money(data.discountAmount)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>{money(data.taxAmount)}</span></div>
            <div className="flex justify-between border-t pt-3 text-base font-semibold"><span>{data.kind === "invoice" ? "Amount due" : "Total paid"}</span><span>{money(data.totalAmount)}</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
