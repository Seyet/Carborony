import { CalendarDays } from "lucide-react"

import { Button, ButtonLink } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type DashboardDateFilterProps = {
  endDate: string
  startDate: string
  todayDate: string
}

export function DashboardDateFilter({
  endDate,
  startDate,
  todayDate,
}: DashboardDateFilterProps) {
  const isToday = startDate === todayDate && endDate === todayDate

  return (
    <form
      action="/app/dashboard"
      className="flex w-full flex-wrap items-end gap-2 sm:w-auto"
      method="get"
    >
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 min-[480px]:grid-cols-2 sm:flex-none">
        <div className="min-w-0 sm:w-40">
          <label
            className="mb-1.5 block text-xs font-medium text-muted-foreground"
            htmlFor="dashboard-start-date"
          >
            Start date
          </label>
          <div className="relative">
            <CalendarDays
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="h-9 bg-background pl-8"
              defaultValue={startDate}
              id="dashboard-start-date"
              max={todayDate}
              name="start"
              required
              type="date"
            />
          </div>
        </div>
        <div className="min-w-0 sm:w-40">
          <label
            className="mb-1.5 block text-xs font-medium text-muted-foreground"
            htmlFor="dashboard-end-date"
          >
            End date
          </label>
          <div className="relative">
            <CalendarDays
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="h-9 bg-background pl-8"
              defaultValue={endDate}
              id="dashboard-end-date"
              max={todayDate}
              name="end"
              required
              type="date"
            />
          </div>
        </div>
      </div>
      <Button className="h-9" type="submit" variant="outline">
        Apply
      </Button>
      {!isToday ? (
        <ButtonLink className="h-9" href="/app/dashboard" variant="ghost">
          Today
        </ButtonLink>
      ) : null}
    </form>
  )
}
