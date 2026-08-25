import type { Metadata } from "next"
import Form from "next/form"
import {
  ChevronLeft,
  ChevronRight,
  History,
  LockKeyhole,
  Search,
  Wrench,
  X,
} from "lucide-react"

import { EmptyState } from "@/components/common"
import { Button, ButtonLink } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ActivityTimeline } from "@/features/activity/activity-timeline"
import {
  ActivityAccessDeniedError,
  activityPageSize,
  ActivitySetupRequiredError,
  getActivityPageData,
} from "@/features/activity/server/get-activity"
import { activityAreas, type ActivityArea } from "@/features/activity/types"

export const metadata: Metadata = { title: "Activity log" }

type ActivityPageProps = {
  searchParams: Promise<{
    area?: string | string[]
    page?: string | string[]
    query?: string | string[]
  }>
}

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

function activityHref({ area, page, query }: { area: string; page: number; query: string }) {
  const params = new URLSearchParams()
  if (query) params.set("query", query)
  if (area) params.set("area", area)
  if (page > 1) params.set("page", String(page))
  const queryString = params.toString()
  return `/app/activity${queryString ? `?${queryString}` : ""}`
}

function MessageCard({ denied = false }: { denied?: boolean }) {
  const Icon = denied ? LockKeyhole : Wrench
  return (
    <Card className="mx-auto mt-16 max-w-xl">
      <CardHeader>
        <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon aria-hidden="true" className="size-5" /></span>
        <CardTitle as="h1">{denied ? "Activity log access required" : "Activity log setup required"}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm leading-6 text-muted-foreground">
        {denied
          ? "Only owners, administrators, and managers can review sensitive audit activity."
          : "Apply the latest Supabase migration to start recording important actions."}
      </CardContent>
    </Card>
  )
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const params = await searchParams
  const parsedPage = Number(first(params.page))
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const query = (first(params.query) ?? "").trim().slice(0, 100)
  const requestedArea = first(params.area) ?? ""
  const area: ActivityArea | "" = activityAreas.some((value) => value === requestedArea)
    ? requestedArea as ActivityArea
    : ""

  let data: Awaited<ReturnType<typeof getActivityPageData>>
  try {
    data = await getActivityPageData({ area, page, query })
  } catch (error) {
    if (error instanceof ActivitySetupRequiredError) return <MessageCard />
    if (error instanceof ActivityAccessDeniedError) return <MessageCard denied />
    throw error
  }

  const hasFilters = Boolean(query || area)
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs text-muted-foreground">Workspace / Accountability</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Activity log</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review important actions and sensitive changes across your business.</p>
      </header>

      <Form action="/app/activity" className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-10 pl-9" defaultValue={query} maxLength={100} name="query" placeholder="Search user, action, or record" type="search" />
        </div>
        <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" defaultValue={area} name="area">
          <option value="">All activity</option>
          <option value="sales">Sales and refunds</option>
          <option value="catalogue">Products and pricing</option>
          <option value="inventory">Stock adjustments</option>
          <option value="expenses">Expenses</option>
          <option value="staff">Staff and permissions</option>
        </select>
        <Button className="h-10" type="submit"><Search aria-hidden="true" />Filter</Button>
        {hasFilters ? <ButtonLink className="h-10" href="/app/activity" variant="outline"><X aria-hidden="true" />Clear</ButtonLink> : null}
      </Form>

      {data.items.length ? (
        <>
          <ActivityTimeline items={data.items} timezone={data.timezone} />
          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>Showing {(data.page - 1) * activityPageSize + 1}–{Math.min(data.page * activityPageSize, data.totalCount)} of {data.totalCount} activities</p>
            <div className="flex items-center gap-2">
              {data.page > 1 ? <ButtonLink href={activityHref({ area, page: data.page - 1, query })} size="sm" variant="outline"><ChevronLeft aria-hidden="true" />Previous</ButtonLink> : <Button disabled size="sm" variant="outline"><ChevronLeft aria-hidden="true" />Previous</Button>}
              <span className="px-2">Page {data.page} of {data.pageCount}</span>
              {data.page < data.pageCount ? <ButtonLink href={activityHref({ area, page: data.page + 1, query })} size="sm" variant="outline">Next<ChevronRight aria-hidden="true" /></ButtonLink> : <Button disabled size="sm" variant="outline">Next<ChevronRight aria-hidden="true" /></Button>}
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          action={hasFilters ? <ButtonLink href="/app/activity" variant="outline">Clear filters</ButtonLink> : undefined}
          description={hasFilters ? "No activities match the selected filters." : "Important actions will appear here as your team works."}
          icon={History}
          title={hasFilters ? "No matching activity" : "No activity yet"}
        />
      )}
    </div>
  )
}
