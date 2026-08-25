import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { z } from "zod"

import { ButtonLink } from "@/components/ui/button"
import { OrderDetails } from "@/features/orders/order-details"
import { OrderReceiptButton } from "@/features/orders/order-receipt-button"
import { OrderStatusActions } from "@/features/orders/order-status-actions"
import { OrdersSetupRequired } from "@/features/orders/orders-setup-required"
import { getOrderDetails, OrdersSetupRequiredError } from "@/features/orders/server/get-orders"
import { ApiError } from "@/lib/api/server"

export const metadata: Metadata = { title: "Order details" }

export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const validation = z.object({ id: z.uuid() }).safeParse(await params)
  if (!validation.success) notFound()

  let order: Awaited<ReturnType<typeof getOrderDetails>> | null = null
  try {
    order = await getOrderDetails(validation.data.id)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    if (!(error instanceof OrdersSetupRequiredError)) throw error
  }
  if (!order) return <OrdersSetupRequired />

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-xs text-muted-foreground"><Link className="hover:text-foreground" href="/app/orders">Orders</Link><span>/</span><span>{order.number}</span></div><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Order details</h1><p className="mt-1 text-sm text-muted-foreground">{order.number}</p></div><div className="flex flex-wrap gap-2"><ButtonLink href="/app/orders" variant="outline"><ArrowLeft aria-hidden="true" />Orders</ButtonLink><OrderReceiptButton orderId={order.id} orderNumber={order.number} /><OrderStatusActions orderId={order.id} orderNumber={order.number} status={order.status} /></div></header>
      <OrderDetails order={order} />
    </div>
  )
}
