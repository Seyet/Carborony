import Link from "next/link"
import { Eye, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { customerSegmentClasses, customerSegmentLabels } from "./customer-segment"
import type { CustomerListItem } from "./types"

export function CustomersTable({ currencyCode, items, timezone }: { currencyCode: string; items: CustomerListItem[]; timezone: string }) {
  const money = new Intl.NumberFormat("en", { currency: currencyCode, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0, style: "currency" })
  const date = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: timezone })
  return <Card className="overflow-hidden py-0"><CardHeader className="border-b py-5"><CardTitle as="h2">Customer directory</CardTitle><p className="text-sm text-muted-foreground">Profiles created manually and captured from transactions.</p></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="pl-4 sm:pl-6">Customer</TableHead><TableHead>Segment</TableHead><TableHead className="text-right">Purchases</TableHead><TableHead className="text-right">Total spent</TableHead><TableHead>Last purchase</TableHead><TableHead className="pr-4 text-right sm:pr-6">Action</TableHead></TableRow></TableHeader><TableBody>{items.map((customer) => <TableRow key={customer.id}><TableCell className="pl-4 sm:pl-6"><div className="flex min-w-56 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><UserRound aria-hidden="true" className="size-4" /></span><span><Link className="block font-medium hover:underline" href={`/app/customers/${customer.id}`}>{customer.name}</Link><span className="block text-xs text-muted-foreground">{customer.phone ?? customer.email ?? "No contact information"}</span></span></div></TableCell><TableCell><Badge className={customerSegmentClasses[customer.segment]} variant="secondary">{customerSegmentLabels[customer.segment]}</Badge></TableCell><TableCell className="text-right">{customer.purchaseCount}</TableCell><TableCell className="text-right font-medium">{money.format(customer.totalSpent)}</TableCell><TableCell><span className="block text-sm">{customer.lastProductName ?? "No purchases"}</span>{customer.lastPurchaseAt ? <span className="block text-xs text-muted-foreground">{date.format(new Date(customer.lastPurchaseAt))}</span> : null}</TableCell><TableCell className="pr-4 text-right sm:pr-6"><Button render={<Link href={`/app/customers/${customer.id}`} />} size="sm" variant="outline"><Eye aria-hidden="true" />View</Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
}
