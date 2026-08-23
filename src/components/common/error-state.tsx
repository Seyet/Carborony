import type { ComponentProps, ReactNode } from "react"
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ErrorStateProps = ComponentProps<"div"> & {
  title?: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  secondaryAction?: ReactNode
  reference?: string
}

function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this page. Please try again in a moment.",
  onRetry,
  retryLabel = "Try again",
  secondaryAction,
  reference,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      data-slot="error-state"
      role="alert"
      className={cn(
        "flex w-full flex-col items-center justify-center px-6 py-16 text-center",
        className
      )}
      {...props}
    >
      <div
        className="mb-5 flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive ring-1 ring-destructive/15"
        aria-hidden="true"
      >
        <TriangleAlertIcon className="size-5" strokeWidth={1.8} />
      </div>
      <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
        {title}
      </h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
        {description}
      </p>
      {onRetry || secondaryAction ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {onRetry ? (
            <Button type="button" size="lg" onClick={onRetry}>
              <RefreshCwIcon data-icon="inline-start" />
              {retryLabel}
            </Button>
          ) : null}
          {secondaryAction}
        </div>
      ) : null}
      {reference ? (
        <p className="mt-5 text-xs text-muted-foreground">
          Error reference: <code className="font-mono">{reference}</code>
        </p>
      ) : null}
    </div>
  )
}

export { ErrorState, type ErrorStateProps }
