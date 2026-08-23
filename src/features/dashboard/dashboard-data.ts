import type { LucideIcon } from "lucide-react"
import {
  Boxes,
  CircleDollarSign,
  ClipboardList,
  Package,
  PackageX,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react"

export type MetricTone = "positive" | "neutral" | "warning" | "danger"

export type DashboardMetric = {
  title: string
  value: string
  helper: string
  icon: LucideIcon
  tone: MetricTone
}

export const dashboardMetrics: readonly DashboardMetric[] = [
  {
    title: "Today’s Sales",
    value: "₦284,650",
    helper: "+12.5% from yesterday",
    icon: CircleDollarSign,
    tone: "positive",
  },
  {
    title: "Today’s Orders",
    value: "34",
    helper: "+8.2% from yesterday",
    icon: ClipboardList,
    tone: "positive",
  },
  {
    title: "Today’s Expenses",
    value: "₦48,200",
    helper: "8 expense entries",
    icon: ReceiptText,
    tone: "neutral",
  },
  {
    title: "Today’s Profit",
    value: "₦186,450",
    helper: "65.5% estimated margin",
    icon: TrendingUp,
    tone: "positive",
  },
  {
    title: "Customers",
    value: "1,248",
    helper: "+18 this month",
    icon: Users,
    tone: "neutral",
  },
  {
    title: "Products",
    value: "326",
    helper: "289 active listings",
    icon: Package,
    tone: "neutral",
  },
  {
    title: "Low Stock",
    value: "12",
    helper: "Needs your attention",
    icon: Boxes,
    tone: "warning",
  },
  {
    title: "Out of Stock",
    value: "4",
    helper: "Restock when ready",
    icon: PackageX,
    tone: "danger",
  },
]

export const weeklySales = [
  { day: "Mon", value: 182000, height: 49 },
  { day: "Tue", value: 236000, height: 64 },
  { day: "Wed", value: 198000, height: 53 },
  { day: "Thu", value: 312000, height: 84 },
  { day: "Fri", value: 268000, height: 72 },
  { day: "Sat", value: 356000, height: 96 },
  { day: "Sun", value: 284650, height: 77 },
] as const

export const topProducts = [
  {
    name: "Classic linen set",
    category: "Apparel",
    units: 24,
    revenue: "₦68,400",
    progress: 92,
    initials: "CL",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  {
    name: "Leather tote bag",
    category: "Accessories",
    units: 18,
    revenue: "₦54,000",
    progress: 76,
    initials: "LT",
    color: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  },
  {
    name: "Ribbed lounge set",
    category: "Apparel",
    units: 22,
    revenue: "₦41,250",
    progress: 64,
    initials: "RL",
    color: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  },
  {
    name: "Cedar soy candle",
    category: "Home",
    units: 32,
    revenue: "₦28,800",
    progress: 51,
    initials: "CC",
    color:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
] as const

export type TransactionStatus = "Completed" | "Pending" | "Refunded"

export const recentTransactions: readonly {
  id: string
  customer: string
  channel: string
  time: string
  amount: string
  status: TransactionStatus
}[] = [
  {
    id: "#SL-1048",
    customer: "Amara Okafor",
    channel: "Storefront",
    time: "10:42 AM",
    amount: "₦24,500",
    status: "Completed",
  },
  {
    id: "#SL-1047",
    customer: "David Mensah",
    channel: "In store",
    time: "10:16 AM",
    amount: "₦18,200",
    status: "Completed",
  },
  {
    id: "#SL-1046",
    customer: "Zainab Bello",
    channel: "Storefront",
    time: "9:48 AM",
    amount: "₦31,750",
    status: "Pending",
  },
  {
    id: "#SL-1045",
    customer: "Tolu Adeniyi",
    channel: "In store",
    time: "9:21 AM",
    amount: "₦12,800",
    status: "Completed",
  },
  {
    id: "#SL-1044",
    customer: "Nneka Eze",
    channel: "Storefront",
    time: "8:54 AM",
    amount: "₦8,600",
    status: "Refunded",
  },
]

export const businessAlerts = [
  {
    title: "12 products are running low",
    description: "Review stock levels before your next sales window.",
    href: "/app/inventory",
    label: "Review inventory",
    tone: "warning" as const,
    icon: Boxes,
  },
  {
    title: "4 products are out of stock",
    description: "These products may need restocking or catalogue updates.",
    href: "/app/catalogue",
    label: "View products",
    tone: "danger" as const,
    icon: PackageX,
  },
  {
    title: "3 orders need review",
    description: "Recent orders are waiting in the orders workspace.",
    href: "/app/orders",
    label: "Open orders",
    tone: "info" as const,
    icon: ShoppingBag,
  },
] as const
