import type { ComponentProps } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const navigationPlaceholders = ["overview", "commerce", "customers", "insights", "settings"]
const metricPlaceholders = ["sales", "orders", "expenses", "customers"]
const mobileNavigationPlaceholders = ["home", "sales", "catalogue", "orders", "more"]

type PageSkeletonProps = ComponentProps<"div"> & {
  label?: string
}

function PageSkeleton({
  label = "Loading page",
  className,
  ...props
}: PageSkeletonProps) {
  return (
    <div
      data-slot="page-skeleton"
      role="status"
      aria-label={label}
      className={cn("w-full", className)}
      {...props}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-44 sm:w-56" />
            <Skeleton className="h-4 w-56 max-w-[65vw] sm:w-80" />
          </div>
          <Skeleton className="hidden h-9 w-28 sm:block" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricPlaceholders.map((metric) => (
            <div
              key={metric}
              className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
            >
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="size-8 rounded-lg" />
              </div>
              <Skeleton className="mt-5 h-7 w-28" />
              <Skeleton className="mt-2 h-3 w-20" />
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,1fr)]">
          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
            <div className="mt-8 flex h-48 items-end gap-2 sm:h-56 sm:gap-3">
              {[42, 68, 51, 78, 57, 88, 70, 82, 62, 74, 54, 80].map(
                (height, index) => (
                  <Skeleton
                    // The fixed sequence keeps the placeholder stable between renders.
                    key={`${height}-${index}`}
                    className="min-w-0 flex-1 rounded-t-md rounded-b-sm"
                    style={{ height: `${height}%` }}
                  />
                )
              )}
            </div>
          </div>

          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="mt-2 h-3 w-40" />
            <div className="mt-6 space-y-4">
              {["first", "second", "third", "fourth"].map((row) => (
                <div key={row} className="flex items-center gap-3">
                  <Skeleton className="size-9 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AppShellSkeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="app-shell-skeleton"
      className={cn("min-h-svh bg-muted/20", className)}
      {...props}
    >
      <aside
        className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r bg-background p-4 lg:block"
        aria-hidden="true"
      >
        <div className="flex h-12 items-center gap-3 px-2">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="mt-4 h-11 w-full rounded-lg" />
        <div className="mt-6 space-y-2">
          {navigationPlaceholders.map((item, index) => (
            <div key={item} className="flex h-9 items-center gap-3 px-2">
              <Skeleton className="size-5 rounded" />
              <Skeleton
                className={cn("h-4", index % 2 === 0 ? "w-24" : "w-20")}
              />
            </div>
          ))}
        </div>
      </aside>

      <div className="lg:pl-64">
        <header
          className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b bg-background/95 px-4 sm:px-6"
          aria-hidden="true"
        >
          <Skeleton className="size-9 rounded-lg lg:hidden" />
          <Skeleton className="hidden h-9 w-full max-w-sm sm:block" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="size-9 rounded-full" />
          </div>
        </header>
        <main className="px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">
          <PageSkeleton />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex h-16 items-center justify-around border-t bg-background px-2 lg:hidden"
        aria-hidden="true"
      >
        {mobileNavigationPlaceholders.map((item) => (
          <div key={item} className="flex flex-col items-center gap-1.5 px-2">
            <Skeleton className="size-5 rounded" />
            <Skeleton className="h-2.5 w-9" />
          </div>
        ))}
      </nav>
    </div>
  )
}

export {
  AppShellSkeleton,
  PageSkeleton,
  type PageSkeletonProps,
}
