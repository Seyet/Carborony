import Link from "next/link"
import { Eye, FileText, ReceiptText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { SalesHistoryItem } from "./types"
import { TransactionDocumentButton } from "./transaction-document-button"

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
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

function statusClass(status: string) {
  if (status === "completed" || status === "paid") {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
  }
  if (status === "refunded" || status === "cancelled" || status === "voided") {
    return "bg-destructive/10 text-destructive"
  }
  return "bg-amber-500/10 text-amber-700 dark:text-amber-400"
}

export function SalesHistoryTable({ items }: { items: SalesHistoryItem[] }) {
  return (
    <Card className="overflow-hidden py-0 shadow-sm">
      <CardHeader className="border-b py-5">
        <CardTitle>Transactions</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 sm:pl-6">Document</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="pr-4 text-right sm:pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const Icon = item.kind === "invoice" ? FileText : ReceiptText
              return (
                <TableRow key={`${item.kind}:${item.id}`}>
                  <TableCell className="pl-4 sm:pl-6">
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon aria-hidden="true" className="size-4" /></span>
                      <span><span className="block font-medium">{item.documentNumber}</span><span className="block text-xs capitalize text-muted-foreground">{item.kind}</span></span>
                    </div>
                  </TableCell>
                  <TableCell>{item.customerName}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(item.issuedAt)}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{item.paymentMethod}</TableCell>
                  <TableCell><Badge className={statusClass(item.status)} variant="secondary">{item.status}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(item.currencyCode, item.totalAmount)}</TableCell>
                  <TableCell className="pr-4 sm:pr-6"><div className="flex justify-end gap-2"><Button render={<Link href={`/app/sales/history/${item.kind}/${item.id}`} />} size="sm" variant="outline"><Eye aria-hidden="true" />View</Button><TransactionDocumentButton documentNumber={item.documentNumber} id={item.id} kind={item.kind} /></div></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
