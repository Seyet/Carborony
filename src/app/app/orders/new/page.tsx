import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ManualOrderForm } from "@/features/orders/manual-order-form"
import { OrdersSetupRequired } from "@/features/orders/orders-setup-required"
import { PosSetupRequiredError, getPosCatalog } from "@/features/sales/pos/server/get-pos-catalog"

export const metadata: Metadata = { title: "Create order" }

export default async function NewOrderPage() {
  let catalog: Awaited<ReturnType<typeof getPosCatalog>> | null = null
  try {
    catalog = await getPosCatalog()
  } catch (error) {
    if (!(error instanceof PosSetupRequiredError)) throw error
  }

  if (!catalog) return <OrdersSetupRequired />

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3"><Button aria-label="Back to orders" render={<Link href="/app/orders" />} size="icon" variant="outline"><ArrowLeft aria-hidden="true" /></Button><div><p className="text-xs text-muted-foreground">Orders / New</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Create order</h1><p className="mt-1 text-sm text-muted-foreground">Create a pending manual order from catalogue products.</p></div></header>
      <ManualOrderForm catalog={catalog} />
    </div>
  )
}

