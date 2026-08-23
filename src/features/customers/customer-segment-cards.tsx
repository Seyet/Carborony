import { Crown, RefreshCcw, Sparkles, UserX, WalletCards } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { customerSegmentLabels } from "./customer-segment"
import type { CustomerSegment, CustomerSegmentMetric } from "./types"

const icons = {
  high_spender: WalletCards,
  inactive: UserX,
  new: Sparkles,
  returning: RefreshCcw,
  vip: Crown,
} satisfies Record<CustomerSegment, typeof Crown>

export function CustomerSegmentCards({ currencyCode, metrics }: { currencyCode: string; metrics: CustomerSegmentMetric[] }) {
  const money = new Intl.NumberFormat("en", { currency: currencyCode, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0, style: "currency" })
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map((metric) => { const Icon = icons[metric.segment]; return <Card key={metric.segment}><CardContent className="flex items-start justify-between p-5"><div><p className="text-xs text-muted-foreground">{customerSegmentLabels[metric.segment]}</p><p className="mt-2 text-2xl font-semibold">{metric.count}</p><p className="mt-1 text-xs text-muted-foreground">{money.format(metric.revenue)} revenue</p></div><span className="flex size-9 items-center justify-center rounded-lg bg-primary/8 text-primary"><Icon aria-hidden="true" className="size-4" /></span></CardContent></Card> })}</div>
}
