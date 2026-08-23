import Link from "next/link"
import { LayoutDashboardIcon, LogInIcon, SearchXIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function NotFound() {
  return (
    <main className="relative flex min-h-[80svh] flex-1 items-center justify-center overflow-hidden bg-background px-6 py-16 text-center">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,var(--color-muted)_0,transparent_55%)] opacity-60"
        aria-hidden="true"
      />
      <div className="relative flex max-w-lg flex-col items-center">
        <span className="mb-5 rounded-full border bg-background px-3 py-1 font-mono text-xs font-medium tracking-widest text-muted-foreground shadow-sm">
          404
        </span>
        <div
          className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-foreground/10 shadow-sm"
          aria-hidden="true"
        >
          <SearchXIcon className="size-6" strokeWidth={1.75} />
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          This page has gone missing
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
          The address may be incorrect, or the page may have moved. Head back to
          your dashboard or sign in to continue.
        </p>
        <div className="mt-7 flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
          <Link
            href="/app/dashboard"
            className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
          >
            <LayoutDashboardIcon aria-hidden="true" />
            Go to dashboard
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full sm:w-auto"
            )}
          >
            <LogInIcon aria-hidden="true" />
            Sign in
          </Link>
        </div>
      </div>
    </main>
  )
}
