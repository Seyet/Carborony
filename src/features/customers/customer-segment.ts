import type { CustomerSegment } from "./types"

export const customerSegmentLabels: Record<CustomerSegment, string> = {
  high_spender: "High spender",
  inactive: "Inactive",
  new: "New customer",
  returning: "Returning customer",
  vip: "VIP",
}

export const customerSegmentClasses: Record<CustomerSegment, string> = {
  high_spender: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  inactive: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  new: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  returning: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  vip: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
}
