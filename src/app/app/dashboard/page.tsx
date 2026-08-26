import type { Metadata } from "next"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { DashboardOverview } from "@/features/dashboard/dashboard-overview"
import { getDashboardData } from "@/features/dashboard/server/get-dashboard"

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

const dashboardTimeZone = "Africa/Lagos"

function getTodayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: dashboardTimeZone,
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

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`))
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
  const todayDate = getTodayDate()
  const legacyDate = getSafeDate(getFirstValue(query.date), todayDate)
  const requestedStart = getSafeDate(getFirstValue(query.start), todayDate)
  const requestedEnd = getSafeDate(getFirstValue(query.end), todayDate)
  const firstDate = requestedStart ?? requestedEnd ?? legacyDate ?? todayDate
  const secondDate = requestedEnd ?? requestedStart ?? legacyDate ?? todayDate
  const [startDate, endDate] =
    firstDate <= secondDate
      ? [firstDate, secondDate]
      : [secondDate, firstDate]
  const startDateLabel = formatDateLabel(startDate)
  const endDateLabel = formatDateLabel(endDate)
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
