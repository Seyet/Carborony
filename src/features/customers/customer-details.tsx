import Link from "next/link"
import { CalendarDays, Cake, Mail, MapPin, Phone, ReceiptText, ShoppingBag, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { customerSegmentClasses, customerSegmentLabels } from "./customer-segment"
import type { CustomerDetailsData } from "./types"

function historyHref(kind: string, id: string) {
  return kind === "order" ? `/app/orders/${id}` : `/app/sales/history/${kind}/${id}`
}

export function CustomerDetails({ data }: { data: CustomerDetailsData }) {
  const customer = data.profile
  const money = new Intl.NumberFormat("en", { currency: data.currencyCode, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0, style: "currency" })
  const date = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: data.timezone })
  const dateTime = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: data.timezone })
  const metrics = [
    ["Orders", String(customer.purchaseCount)],
    ["Total spent", money.format(customer.totalSpent)],
    ["Average order", money.format(customer.averageOrder)],
    ["Last purchase", customer.lastPurchaseAt ? date.format(new Date(customer.lastPurchaseAt)) : "No purchases"],
  ]

  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <Card key={label}><CardContent className="p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p>{label === "Last purchase" && customer.lastProductName ? <p className="mt-1 truncate text-xs text-muted-foreground">{customer.lastProductName}</p> : null}</CardContent></Card>)}</div>
    <div className="grid items-start gap-6 xl:grid-cols-[340px_minmax(0,1fr)]"><div className="space-y-4"><Card><CardHeader><CardTitle className="flex items-center gap-2"><UserRound aria-hidden="true" className="size-4" />Customer information</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><Badge className={customerSegmentClasses[customer.segment]} variant="secondary">{customerSegmentLabels[customer.segment]}</Badge>{customer.phone ? <p className="flex items-center gap-3"><Phone aria-hidden="true" className="size-4 text-muted-foreground" />{customer.phone}</p> : null}{customer.email ? <p className="flex items-center gap-3 break-all"><Mail aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />{customer.email}</p> : null}{customer.address ? <p className="flex items-start gap-3"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span className="whitespace-pre-wrap">{customer.address}</span></p> : null}{customer.birthday ? <p className="flex items-center gap-3"><Cake aria-hidden="true" className="size-4 text-muted-foreground" />{date.format(new Date(`${customer.birthday}T00:00:00Z`))}</p> : null}<p className="flex items-center gap-3 text-muted-foreground"><CalendarDays aria-hidden="true" className="size-4" />Customer since {date.format(new Date(customer.createdAt))}</p><p className="capitalize text-xs text-muted-foreground">Source: {customer.source}</p></CardContent></Card>{customer.tags.length ? <Card><CardHeader><CardTitle>Tags</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{customer.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</CardContent></Card> : null}{customer.notes ? <Card><CardHeader><CardTitle>Notes</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm text-muted-foreground">{customer.notes}</p></CardContent></Card> : null}</div>
      <Card className="overflow-hidden py-0"><CardHeader className="border-b py-5"><CardTitle className="flex items-center gap-2"><ReceiptText aria-hidden="true" className="size-4" />Purchase history</CardTitle><p className="text-sm text-muted-foreground">Sales, invoices, and orders linked to this customer.</p></CardHeader><CardContent className="p-0">{data.history.length ? <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="pl-4 sm:pl-6">Transaction</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Payment</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="pr-4 text-right sm:pr-6">Action</TableHead></TableRow></TableHeader><TableBody>{data.history.map((purchase) => <TableRow key={`${purchase.kind}:${purchase.id}`}><TableCell className="pl-4 sm:pl-6"><span className="flex items-center gap-2 font-medium capitalize"><ShoppingBag aria-hidden="true" className="size-4 text-muted-foreground" />{purchase.kind} {purchase.number}</span><span className="block text-xs text-muted-foreground">{purchase.productName ?? "Transaction"}</span></TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{dateTime.format(new Date(purchase.issuedAt))}</TableCell><TableCell className="capitalize">{purchase.status}</TableCell><TableCell className="capitalize text-muted-foreground">{purchase.paymentStatus}</TableCell><TableCell className="text-right font-medium">{money.format(purchase.totalAmount)}</TableCell><TableCell className="pr-4 text-right sm:pr-6"><Button render={<Link href={historyHref(purchase.kind, purchase.id)} />} size="sm" variant="outline">View</Button></TableCell></TableRow>)}</TableBody></Table> : <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center"><ReceiptText aria-hidden="true" className="size-8 text-muted-foreground/60" /><p className="mt-3 font-medium">No purchase history</p><p className="mt-1 text-sm text-muted-foreground">Linked sales and orders will appear here.</p></div>}</CardContent></Card>
    </div>
  </div>
}
