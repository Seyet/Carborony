"use client"

import { useEffect } from "react"

import { ErrorState } from "@/components/common/error-state"

type RootErrorProps = {
  error: Error & { digest?: string }
  retry: () => void
}

export default function RootError({ error, retry }: RootErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-[70svh] flex-1 items-center justify-center bg-background">
      <ErrorState
        description="An unexpected error interrupted this page. Your data is safe, and you can try loading it again."
        onRetry={retry}
        reference={error.digest}
      />
    </main>
  )
}
