import type { LucideIcon } from "lucide-react"

export type MetricTone = "positive" | "neutral" | "warning" | "danger"

export type DashboardMetric = {
  title: string
  value: string
  helper: string
  icon: LucideIcon
  tone: MetricTone
}

export type DashboardSalesPoint = { label: string; value: number }

export type DashboardTopProduct = {
  category: string | null
  id: string
  name: string
  revenue: number
  units: number
}

export type DashboardTransaction = {
  amount: number
  channel: string
  customer: string
  id: string
  soldAt: string
  status: "completed" | "pending" | "refunded"
}

export type DashboardAlert = {
  count: number
  href: string
  kind: "low-stock" | "out-of-stock" | "pending-orders"
}
