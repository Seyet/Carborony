import type { ComponentProps, ReactNode } from "react"
import { InboxIcon, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type EmptyStateProps = ComponentProps<"div"> & {
  title: string
  description?: string
  icon?: LucideIcon
  action?: ReactNode
  compact?: boolean
}

function EmptyState({
  title,
  description,
  icon: Icon = InboxIcon,
  action,
  compact = false,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex w-full flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center",
        compact ? "min-h-56 py-8" : "min-h-80 py-12",
        className
      )}
      {...props}
    >
      <div className="relative mb-5" aria-hidden="true">
        <div className="absolute inset-0 scale-150 rounded-full bg-primary/6 blur-xl" />
        <div className="relative flex size-12 items-center justify-center rounded-xl bg-background text-muted-foreground ring-1 ring-foreground/10 shadow-sm">
          <Icon className="size-5" strokeWidth={1.75} />
        </div>
      </div>
      <h2 className="font-heading text-base font-semibold tracking-tight">
        {title}
      </h2>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
        </div>
      ) : null}
    </div>
  )
}

export { EmptyState, type EmptyStateProps }
