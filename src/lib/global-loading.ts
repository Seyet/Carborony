type GlobalLoadingKind = "navigation" | "operation"

type GlobalLoadingOptions = {
  delayMs?: number
  description?: string
  kind?: GlobalLoadingKind
  timeoutMs?: number
  title?: string
}

type LoadingEntry = Required<Pick<GlobalLoadingOptions, "description" | "kind" | "title">> & {
  id: symbol
  visible: boolean
}

type GlobalLoadingSnapshot = {
  description: string
  open: boolean
  title: string
}

const defaultSnapshot: GlobalLoadingSnapshot = {
  description: "Please wait while we complete your request.",
  open: false,
  title: "Working on it",
}

const listeners = new Set<() => void>()
let entries: LoadingEntry[] = []
let snapshot = defaultSnapshot

function publish() {
  const activeEntry = entries.findLast((entry) => entry.visible)
  snapshot = activeEntry
    ? {
        description: activeEntry.description,
        open: true,
        title: activeEntry.title,
      }
    : defaultSnapshot

  listeners.forEach((listener) => listener())
}

function removeEntry(id: symbol) {
  const nextEntries = entries.filter((entry) => entry.id !== id)
  if (nextEntries.length === entries.length) return
  entries = nextEntries
  publish()
}

function beginGlobalLoading({
  delayMs = 150,
  description = "Please wait while we complete your request.",
  kind = "operation",
  timeoutMs,
  title = "Working on it",
}: GlobalLoadingOptions = {}) {
  const id = Symbol("global-loading")
  const entry: LoadingEntry = { description, id, kind, title, visible: delayMs <= 0 }
  entries = [...entries, entry]

  let finished = false
  let delayTimer: ReturnType<typeof setTimeout> | undefined
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined

  if (entry.visible) {
    publish()
  } else {
    delayTimer = setTimeout(() => {
      if (finished || !entries.some((item) => item.id === id)) return
      entries = entries.map((item) => item.id === id ? { ...item, visible: true } : item)
      publish()
    }, delayMs)
  }

  if (timeoutMs !== undefined) {
    timeoutTimer = setTimeout(() => removeEntry(id), timeoutMs)
  }

  return function finishGlobalLoading() {
    if (finished) return
    finished = true
    if (delayTimer) clearTimeout(delayTimer)
    if (timeoutTimer) clearTimeout(timeoutTimer)
    removeEntry(id)
  }
}

function beginNavigationLoading() {
  return beginGlobalLoading({
    description: "Please wait while we open the next page.",
    kind: "navigation",
    timeoutMs: 30_000,
    title: "Loading page",
  })
}

function finishGlobalLoadingKind(kind: GlobalLoadingKind) {
  const nextEntries = entries.filter((entry) => entry.kind !== kind)
  if (nextEntries.length === entries.length) return
  entries = nextEntries
  publish()
}

function getGlobalLoadingSnapshot() {
  return snapshot
}

function getGlobalLoadingServerSnapshot() {
  return defaultSnapshot
}

function subscribeToGlobalLoading(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

async function withGlobalLoading<T>(
  operation: () => Promise<T>,
  options?: GlobalLoadingOptions,
) {
  const finish = beginGlobalLoading(options)
  try {
    return await operation()
  } finally {
    finish()
  }
}

export {
  beginGlobalLoading,
  beginNavigationLoading,
  finishGlobalLoadingKind,
  getGlobalLoadingServerSnapshot,
  getGlobalLoadingSnapshot,
  subscribeToGlobalLoading,
  withGlobalLoading,
  type GlobalLoadingOptions,
}
