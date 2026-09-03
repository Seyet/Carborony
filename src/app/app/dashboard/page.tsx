import type { Metadata } from "next"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { DashboardOverview } from "@/features/dashboard/dashboard-overview"
import { getDashboardData } from "@/features/dashboard/server/get-dashboard"
import { createClient } from "@/lib/supabase/server"
import { formatBusinessDate } from "@/lib/formatting"

export const metadata: Metadata = {
  title: "Dashboard",
}

type DashboardPageProps = {
  searchParams: Promise<{
    date?: string | string[]
    end?: string | string[]
    start?: string | string[]
  }>
}

function getTodayDate(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(new Date())
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const parsedDate = new Date(`${value}T00:00:00Z`)

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value
  )
}

function formatDateLabel(value: string, preferences: Parameters<typeof formatBusinessDate>[1]) {
  return formatBusinessDate(value + "T00:00:00Z", { ...preferences, timeZone: "UTC" })
}

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function getSafeDate(value: string | undefined, todayDate: string) {
  return value && isValidDate(value) && value <= todayDate ? value : null
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const [business, query] = await Promise.all([getCurrentBusiness(), searchParams])
  const supabase = await createClient()
  const settingsResult = await supabase.from("businesses")
    .select("date_format, locale, time_format, timezone")
    .eq("id", business.id)
    .single()
  if (settingsResult.error || !settingsResult.data) {
    throw new Error("Unable to load dashboard regional settings.", { cause: settingsResult.error })
  }
  const preferences = {
    dateFormat: settingsResult.data.date_format as Parameters<typeof formatBusinessDate>[1]["dateFormat"],
    locale: settingsResult.data.locale,
    timeFormat: settingsResult.data.time_format as Parameters<typeof formatBusinessDate>[1]["timeFormat"],
    timeZone: settingsResult.data.timezone,
  }
  const todayDate = getTodayDate(preferences.timeZone)
  const legacyDate = getSafeDate(getFirstValue(query.date), todayDate)
  const requestedStart = getSafeDate(getFirstValue(query.start), todayDate)
  const requestedEnd = getSafeDate(getFirstValue(query.end), todayDate)
  const firstDate = requestedStart ?? requestedEnd ?? legacyDate ?? todayDate
  const secondDate = requestedEnd ?? requestedStart ?? legacyDate ?? todayDate
  const [startDate, endDate] =
    firstDate <= secondDate
      ? [firstDate, secondDate]
      : [secondDate, firstDate]
  const startDateLabel = formatDateLabel(startDate, preferences)
  const endDateLabel = formatDateLabel(endDate, preferences)
  const dateRangeLabel =
    startDate === endDate
      ? startDateLabel
      : `${startDateLabel} – ${endDateLabel}`
  const dashboard = await getDashboardData(startDate, endDate)

  return (
    <DashboardOverview
      businessName={business.name}
      dateRangeLabel={dateRangeLabel}
      endDate={endDate}
      dashboard={dashboard}
      startDate={startDate}
      todayDate={todayDate}
    />
  )
}
