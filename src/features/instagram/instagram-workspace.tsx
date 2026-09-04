"use client"

import { useMemo, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ImageIcon,
  Camera as InstagramIcon,
  Layers3,
  PackageCheck,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { InstagramConnectionCard } from "./instagram-connection-card"
import type {
  InstagramImportStatus,
  InstagramImportSummary,
  InstagramWorkspaceData,
} from "./types"

type QueueFilter = "all" | InstagramImportStatus

const filterOptions: Array<{ label: string; value: QueueFilter }> = [
  { label: "All posts", value: "all" },
  { label: "Needs review", value: "needs_review" },
  { label: "Missing details", value: "incomplete" },
  { label: "Possible duplicates", value: "possible_duplicate" },
  { label: "Ready", value: "ready" },
  { label: "Catalogue drafts", value: "catalogue_draft" },
  { label: "Published", value: "published" },
  { label: "Attached", value: "attached" },
  { label: "Ignored", value: "ignored" },
  { label: "Failed", value: "failed" },
]

const statusDetails: Record<InstagramImportStatus, { label: string; className: string }> = {
  attached: { label: "Attached", className: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  catalogue_draft: { label: "Catalogue draft", className: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
  ignored: { label: "Ignored", className: "bg-muted text-muted-foreground" },
  incomplete: { label: "Missing details", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  needs_review: { label: "Needs review", className: "bg-violet-500/10 text-violet-700 dark:text-violet-400" },
  possible_duplicate: { label: "Possible duplicate", className: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
  published: { label: "Published", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  ready: { label: "Ready", className: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400" },
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown date"
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

function formatMoney(currency: string | null, value: number | null) {
  if (value === null || !currency) return "Price needed"
  try {
    return new Intl.NumberFormat(undefined, {
      currency,
      maximumFractionDigits: 2,
      style: "currency",
    }).format(value)
  } catch {
    return `${currency} ${value.toLocaleString()}`
  }
}

function MediaPreview({ item }: { item: InstagramImportSummary }) {
  const Icon = item.mediaType === "image" ? ImageIcon : item.mediaType === "carousel" ? Layers3 : Play
  return (
    <div
      className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#312e81,#a21caf_48%,#fb923c)] text-white"
      style={item.thumbnailUrl ? {
        backgroundImage: `linear-gradient(rgba(15,23,42,.12),rgba(15,23,42,.28)),url(${JSON.stringify(item.thumbnailUrl)})`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      } : undefined}
    >
      {!item.thumbnailUrl ? (
        <span className="flex size-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
          <Icon aria-hidden="true" className="size-6" />
        </span>
      ) : null}
      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[11px] font-medium capitalize backdrop-blur">
        <Icon aria-hidden="true" className="size-3" />
        {item.mediaType}
      </span>
      <span className="absolute bottom-3 right-3 rounded-full bg-black/45 px-2 py-1 text-[11px] font-medium backdrop-blur">
        {Math.round(item.suggested.overallConfidence * 100)}% matched
      </span>
    </div>
  )
}

function ImportCard({ item }: { item: InstagramImportSummary }) {
  const status = statusDetails[item.status]
  const resolved = ["attached", "catalogue_draft", "ignored", "published"].includes(item.status)
  return (
    <Card className="gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
      <MediaPreview item={item} />
      <CardContent className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge className={status.className} variant="secondary">{status.label}</Badge>
          <span className="text-xs text-muted-foreground">{formatDate(item.publishedAt)}</span>
        </div>

        <div className="mt-3">
          <h3 className="line-clamp-1 text-base font-semibold">
            {item.suggested.name || "Product name needed"}
          </h3>
          <p className={cn(
            "mt-1 text-lg font-semibold tabular-nums",
            item.suggested.price === null && "text-amber-700 dark:text-amber-400",
          )}>
            {formatMoney(item.suggested.currency, item.suggested.price)}
          </p>
          <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
            {item.caption || "This post does not have a caption."}
          </p>
        </div>

        <div className="mt-3 flex min-h-6 flex-wrap gap-1.5">
          {item.suggested.category ? <Badge variant="outline">{item.suggested.category}</Badge> : null}
          {item.suggested.colours.slice(0, 2).map((colour) => <Badge key={colour} variant="outline">{colour}</Badge>)}
          {item.suggested.colours.length > 2 ? <Badge variant="outline">+{item.suggested.colours.length - 2}</Badge> : null}
        </div>

        {item.duplicate ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-orange-500/8 p-2.5 text-xs text-orange-800 dark:text-orange-300">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <span>{Math.round(item.duplicate.score * 100)}% match with “{item.duplicate.name}”</span>
          </div>
        ) : item.suggested.missingFields.length ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-500/8 p-2.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <span>Needs {item.suggested.missingFields.slice(0, 2).join(" and ").toLowerCase()}</span>
          </div>
        ) : (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-500/8 p-2.5 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <span>Required details were found</span>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <a className="text-xs font-medium text-muted-foreground hover:text-foreground" href={item.permalink} rel="noreferrer" target="_blank">
            Original post
          </a>
          <ButtonLink href={`/app/marketing/instagram/${item.id}`} size="sm" variant={resolved ? "outline" : "default"}>
            {resolved ? "View import" : "Review draft"}
          </ButtonLink>
        </div>
      </CardContent>
    </Card>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: number }) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <span>
          <span className="block text-xs text-muted-foreground">{label}</span>
          <strong className="block text-xl tabular-nums">{value}</strong>
        </span>
      </CardContent>
    </Card>
  )
}

export function InstagramWorkspace({ data }: { data: InstagramWorkspaceData }) {
  const [filter, setFilter] = useState<QueueFilter>("all")
  const [query, setQuery] = useState("")
  const filteredImports = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return data.imports.filter((item) => {
      if (filter !== "all" && item.status !== filter) return false
      if (!normalizedQuery) return true
      return [item.caption, item.suggested.name, item.suggested.category]
        .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery))
    })
  }, [data.imports, filter, query])
  const reviewCount = data.imports.filter((item) => ["needs_review", "incomplete", "possible_duplicate", "ready"].includes(item.status)).length
  const publishedCount = data.imports.filter((item) => item.status === "published").length
  const duplicateCount = data.imports.filter((item) => item.status === "possible_duplicate").length
  const showQueue = data.connection.status === "connected" || data.imports.length > 0

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <InstagramIcon aria-hidden="true" className="size-3.5" />
            Instagram to catalogue
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Instagram imports</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Turn eligible posts into editable product drafts, review every detail, then choose what reaches your catalogue.
          </p>
        </div>
        <Badge className="w-fit gap-1.5" variant="secondary">
          <ShieldCheck aria-hidden="true" /> Manual approval only
        </Badge>
      </header>

      <InstagramConnectionCard canManage={data.canConnect} connection={data.connection} isPreview={data.isPreview} />

      {showQueue ? (
        <>
          <section aria-label="Instagram import summary" className="grid gap-3 sm:grid-cols-3">
            <Metric icon={Clock3} label="Waiting for review" value={reviewCount} />
            <Metric icon={CircleAlert} label="Possible duplicates" value={duplicateCount} />
            <Metric icon={PackageCheck} label="Published products" value={publishedCount} />
          </section>

          <section>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Import queue</h2>
                <p className="mt-1 text-sm text-muted-foreground">Rule-based suggestions remain editable until you approve them.</p>
              </div>
              <label className="relative block w-full sm:w-64">
                <span className="sr-only">Search imported posts</span>
                <Search aria-hidden="true" className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" onValueChange={setQuery} placeholder="Search imports" value={query} />
              </label>
            </div>

            <div aria-label="Filter Instagram imports" className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group">
              {filterOptions.map((option) => {
                const count = option.value === "all"
                  ? data.imports.length
                  : data.imports.filter((item) => item.status === option.value).length
                return (
                  <button
                    aria-pressed={filter === option.value}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors hover:bg-muted",
                      filter === option.value && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                    )}
                    key={option.value}
                    onClick={() => setFilter(option.value)}
                    type="button"
                  >
                    {option.label}
                    <span className={cn("tabular-nums opacity-65", filter === option.value && "opacity-85")}>{count}</span>
                  </button>
                )
              })}
            </div>

            {filteredImports.length ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredImports.map((item) => <ImportCard item={item} key={item.id} />)}
              </div>
            ) : (
              <Card className="mt-4 border-dashed">
                <CardContent className="flex min-h-56 flex-col items-center justify-center text-center">
                  <Search aria-hidden="true" className="size-8 text-muted-foreground" />
                  <h3 className="mt-3 font-semibold">No imports found</h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">Try another filter or synchronize Instagram to look for recent posts.</p>
                </CardContent>
              </Card>
            )}
          </section>

          <div className="flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>Suggestions on this screen come from predictable caption rules. The original post is preserved and no product is created until a person reviews it.</p>
          </div>
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex min-h-64 flex-col items-center justify-center text-center">
            <InstagramIcon aria-hidden="true" className="size-9 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold">Connect Instagram to begin</h2>
            <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">Once connected, recent professional-account posts will appear here for review and catalogue preparation.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
