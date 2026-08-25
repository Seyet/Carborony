import type { Json } from "@/types/database"

export const activityAreas = [
  "sales",
  "catalogue",
  "inventory",
  "expenses",
  "staff",
] as const

export type ActivityArea = (typeof activityAreas)[number]

export type ActivityItem = {
  action: string
  actorName: string
  actorUserId: string | null
  entityId: string | null
  entityName: string | null
  entityType: string
  id: string
  newValue: Json | null
  occurredAt: string
  previousValue: Json | null
}

export type ActivityPageData = {
  items: ActivityItem[]
  page: number
  pageCount: number
  timezone: string
  totalCount: number
}
