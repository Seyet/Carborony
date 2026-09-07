"use client"

import { useEffect, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"

import { beginNavigationLoading } from "@/lib/global-loading"

function useLoadingRouter() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const finishRef = useRef<(() => void) | null>(null)

  function navigate(operation: () => void) {
    finishRef.current?.()
    finishRef.current = beginNavigationLoading()
    startTransition(operation)
  }

  useEffect(() => {
    if (!pending && finishRef.current) {
      finishRef.current()
      finishRef.current = null
    }
  }, [pending])

  useEffect(() => () => {
    finishRef.current?.()
    finishRef.current = null
  }, [])

  function push(
    ...parameters: Parameters<typeof router.push>
  ) {
    navigate(() => router.push(...parameters))
  }

  function replace(
    ...parameters: Parameters<typeof router.replace>
  ) {
    navigate(() => router.replace(...parameters))
  }

  function refresh() {
    navigate(() => router.refresh())
  }

  function back() {
    navigate(() => router.back())
  }

  function forward() {
    navigate(() => router.forward())
  }

  return {
    ...router,
    back,
    forward,
    push,
    refresh,
    replace,
  }
}

export { useLoadingRouter }
