"use client"

import { Suspense, useEffect, useSyncExternalStore, type ReactNode } from "react"
import { usePathname, useSearchParams } from "next/navigation"

import {
  beginNavigationLoading,
  finishGlobalLoadingKind,
  getGlobalLoadingServerSnapshot,
  getGlobalLoadingSnapshot,
  subscribeToGlobalLoading,
} from "@/lib/global-loading"
import { LoadingModal } from "./loading-modal"

function isModifiedClick(event: MouseEvent) {
  return event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
}

function shouldTrackAnchor(anchor: HTMLAnchorElement, event: MouseEvent) {
  if (
    isModifiedClick(event)
    || anchor.hasAttribute("download")
    || anchor.dataset.loading === "false"
    || (anchor.target && anchor.target !== "_self")
  ) return false

  const destination = new URL(anchor.href, window.location.href)
  if (!['http:', 'https:'].includes(destination.protocol)) return false
  if (destination.origin !== window.location.origin) return true

  const current = new URL(window.location.href)
  return destination.pathname !== current.pathname || destination.search !== current.search
}

function shouldTrackForm(form: HTMLFormElement) {
  const action = form.getAttribute("action")
  if (action === null) return false

  const destination = new URL(action || window.location.href, window.location.href)
  if (destination.origin !== window.location.origin) return true

  if ((form.getAttribute("method") ?? "get").toLowerCase() === "get") {
    const query = new URLSearchParams()
    for (const [name, value] of new FormData(form)) {
      if (typeof value === "string") query.append(name, value)
    }
    destination.search = query.toString()
  }

  const current = new URL(window.location.href)
  return destination.pathname !== current.pathname || destination.search !== current.search
}

function NavigationInteractionTracker() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest<HTMLAnchorElement>("a[href]")
      if (!anchor || !shouldTrackAnchor(anchor, event)) return
      beginNavigationLoading()
    }

    function handleSubmit(event: SubmitEvent) {
      const form = event.target
      if (!(form instanceof HTMLFormElement) || form.dataset.loading === "false") return
      if (form.target && form.target !== "_self") return
      // Navigation forms declare an action. Mutation forms in this app use an
      // onSubmit handler and are covered by the request client instead.
      if (!shouldTrackForm(form)) return
      beginNavigationLoading()
    }

    function handleHistoryNavigation() {
      beginNavigationLoading()
    }

    document.addEventListener("click", handleClick, true)
    document.addEventListener("submit", handleSubmit, true)
    window.addEventListener("popstate", handleHistoryNavigation)

    return () => {
      document.removeEventListener("click", handleClick, true)
      document.removeEventListener("submit", handleSubmit, true)
      window.removeEventListener("popstate", handleHistoryNavigation)
    }
  }, [])

  return null
}

function NavigationCompletionTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const routeKey = `${pathname}?${searchParams.toString()}`

  useEffect(() => {
    finishGlobalLoadingKind("navigation")
  }, [routeKey])

  return null
}

function GlobalLoadingIndicator() {
  const state = useSyncExternalStore(
    subscribeToGlobalLoading,
    getGlobalLoadingSnapshot,
    getGlobalLoadingServerSnapshot,
  )

  return (
    <LoadingModal
      description={state.description}
      open={state.open}
      title={state.title}
    />
  )
}

function GlobalLoadingProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <NavigationInteractionTracker />
      <Suspense fallback={null}>
        <NavigationCompletionTracker />
      </Suspense>
      <GlobalLoadingIndicator />
    </>
  )
}

export { GlobalLoadingProvider }
