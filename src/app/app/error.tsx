"use client"

import { useEffect } from "react"

import { ErrorState } from "@/components/common"

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-105 rounded-xl bg-card shadow-sm ring-1 ring-foreground/8">
      <ErrorState
        className="min-h-105"
        title="We couldn’t load this workspace"
        description="Something unexpected happened while preparing this page. Try again; your business data has not been changed."
        onRetry={retry}
        reference={error.digest}
      />
    </div>
  )
}
