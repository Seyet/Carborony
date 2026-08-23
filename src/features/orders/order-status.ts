import type { OrderStatus } from "./types"

export const orderStatusLabels: Record<OrderStatus, string> = {
  cancelled: "Cancelled",
  completed: "Completed",
  confirmed: "Confirmed",
  pending: "Pending",
  processing: "Processing",
  ready: "Ready",
  refunded: "Refunded",
}

export function orderStatusClass(status: OrderStatus) {
  if (status === "completed") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
  if (status === "cancelled" || status === "refunded") return "bg-destructive/10 text-destructive"
  if (status === "ready") return "bg-blue-500/10 text-blue-700 dark:text-blue-400"
  if (status === "processing" || status === "confirmed") return "bg-violet-500/10 text-violet-700 dark:text-violet-400"
  return "bg-amber-500/10 text-amber-700 dark:text-amber-400"
}

export function allowedOrderTransitions(status: OrderStatus): OrderStatus[] {
  if (status === "pending") return ["confirmed", "cancelled"]
  if (status === "confirmed") return ["processing", "cancelled"]
  if (status === "processing") return ["ready", "cancelled"]
  if (status === "ready") return ["completed", "cancelled"]
  if (status === "completed") return ["refunded"]
  return []
}

