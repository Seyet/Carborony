import {
  BanknoteArrowDown,
  Boxes,
  Globe2,
  Package,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  UserRoundCog,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { Json } from "@/types/database"
import type { ActivityItem } from "./types"

const ignoredAuditFields = new Set([
  "business_id",
  "created_at",
  "created_by",
  "id",
  "updated_at",
])

type JsonRecord = Record<string, Json | undefined>

function asRecord(value: Json | null): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {}
}

function formatFieldName(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())
}

function formatValue(value: Json | undefined) {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function changedFields(item: ActivityItem) {
  const before = asRecord(item.previousValue)
  const after = asRecord(item.newValue)
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])

  return [...keys]
    .filter((key) => !ignoredAuditFields.has(key))
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .sort()
    .map((key) => ({ key, previous: before[key], next: after[key] }))
}

function numberValue(value: Json | undefined) {
  return typeof value === "number" ? value : Number(value ?? 0)
}

function actionPresentation(item: ActivityItem): {
  description: string
  icon: LucideIcon
  tone: string
} {
  const entity = item.entityName ? ` ${item.entityName}` : ""
  const next = asRecord(item.newValue)

  switch (item.action) {
    case "sale.created":
      return { description: `created sale${entity}`, icon: ShoppingCart, tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" }
    case "sale.refunded":
    case "order.refunded":
      return { description: `refunded${entity}`, icon: BanknoteArrowDown, tone: "bg-red-500/10 text-red-700 dark:text-red-400" }
    case "order.created":
      return { description: `created order${entity}`, icon: ReceiptText, tone: "bg-blue-500/10 text-blue-700 dark:text-blue-400" }
    case "stock.adjusted": {
      const quantity = numberValue(next.quantity_delta)
      const operation = quantity >= 0 ? "added" : "removed"
      return {
        description: `${operation} ${Math.abs(quantity)} units of${entity}`,
        icon: Boxes,
        tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      }
    }
    case "product.created":
      return { description: `created product${entity}`, icon: Package, tone: "bg-violet-500/10 text-violet-700 dark:text-violet-400" }
    case "product.deleted":
      return { description: `deleted product${entity}`, icon: Package, tone: "bg-red-500/10 text-red-700 dark:text-red-400" }
    case "product.price_changed":
    case "variant.price_changed":
      return { description: `updated the price of${entity}`, icon: Package, tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" }
    case "expense.created":
      return { description: `recorded expense${entity}`, icon: ReceiptText, tone: "bg-blue-500/10 text-blue-700 dark:text-blue-400" }
    case "expense.deleted":
      return { description: `deleted expense${entity}`, icon: ReceiptText, tone: "bg-red-500/10 text-red-700 dark:text-red-400" }
    case "staff.permission_changed":
      return { description: `changed permissions for${entity}`, icon: ShieldCheck, tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" }
    case "staff.added":
    case "staff.invited":
      return { description: `${item.action === "staff.invited" ? "invited" : "added"}${entity}`, icon: UserRoundCog, tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" }
    case "staff.removed":
    case "staff.invitation_revoked":
      return { description: `${item.action === "staff.removed" ? "removed" : "revoked the invitation for"}${entity}`, icon: UserRoundCog, tone: "bg-red-500/10 text-red-700 dark:text-red-400" }
    case "website.published":
      return { description: `published the website for${entity}`, icon: Globe2, tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" }
    case "website.paused":
      return { description: `paused the website for${entity}`, icon: Globe2, tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" }
    default:
      return {
        description: `${item.action.split(".")[1]?.replaceAll("_", " ") ?? "updated"}${entity}`,
        icon: ShieldCheck,
        tone: "bg-muted text-muted-foreground",
      }
  }
}

function dateKey(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(new Date(value))
  const values = new Map(parts.map((part) => [part.type, part.value]))
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`
}

function dayLabel(value: string, timezone: string) {
  const key = dateKey(value, timezone)
  const today = dateKey(new Date().toISOString(), timezone)
  const yesterday = dateKey(new Date(Date.now() - 86_400_000).toISOString(), timezone)
  if (key === today) return "Today"
  if (key === yesterday) return "Yesterday"
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "long",
    timeZone: timezone,
  }).format(new Date(value))
}

function timeLabel(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value))
}

export function ActivityTimeline({
  items,
  timezone,
}: {
  items: ActivityItem[]
  timezone: string
}) {
  const groups = items.reduce<Array<{ date: string; items: ActivityItem[] }>>(
    (result, item) => {
      const key = dateKey(item.occurredAt, timezone)
      const current = result.at(-1)
      if (current?.date === key) current.items.push(item)
      else result.push({ date: key, items: [item] })
      return result
    },
    [],
  )

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.date}>
          <h2 className="mb-3 text-sm font-semibold">{dayLabel(group.items[0].occurredAt, timezone)}</h2>
          <Card className="py-0 shadow-sm">
            <CardContent className="p-0">
              <ol className="divide-y">
                {group.items.map((item) => {
                  const presentation = actionPresentation(item)
                  const Icon = presentation.icon
                  const changes = changedFields(item)

                  return (
                    <li className="grid grid-cols-[4.5rem_2rem_minmax(0,1fr)] gap-3 px-4 py-4 sm:grid-cols-[5.5rem_2.25rem_minmax(0,1fr)] sm:px-6" key={item.id}>
                      <time className="pt-1 text-xs tabular-nums text-muted-foreground" dateTime={item.occurredAt}>
                        {timeLabel(item.occurredAt, timezone)}
                      </time>
                      <span className={`flex size-8 items-center justify-center rounded-full ${presentation.tone}`}>
                        <Icon aria-hidden="true" className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="leading-6">
                          <strong className="font-semibold">{item.actorName}</strong>{" "}
                          {presentation.description}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{item.action.replaceAll("_", " ")}</Badge>
                          <span className="text-xs text-muted-foreground">{item.entityType.replaceAll("_", " ")}</span>
                        </div>
                        {changes.length ? (
                          <details className="mt-3 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
                            <summary className="cursor-pointer font-medium text-muted-foreground">View audit details</summary>
                            <div className="mt-3 overflow-x-auto">
                              <table className="w-full min-w-md text-left">
                                <thead className="text-muted-foreground">
                                  <tr><th className="pb-2 font-medium">Field</th><th className="pb-2 font-medium">Previous value</th><th className="pb-2 font-medium">New value</th></tr>
                                </thead>
                                <tbody className="divide-y">
                                  {changes.map((change) => (
                                    <tr key={change.key}>
                                      <th className="py-2 pr-4 font-medium">{formatFieldName(change.key)}</th>
                                      <td className="max-w-56 break-words py-2 pr-4 text-muted-foreground">{formatValue(change.previous)}</td>
                                      <td className="max-w-56 break-words py-2 text-muted-foreground">{formatValue(change.next)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </details>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </CardContent>
          </Card>
        </section>
      ))}
    </div>
  )
}
