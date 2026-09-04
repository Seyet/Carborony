"use client"

import { useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  ImageIcon,
  Camera as InstagramIcon,
  Layers3,
  LoaderCircle,
  PackageCheck,
  Play,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button, ButtonLink } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { postJson } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import type {
  InstagramDraftField,
  InstagramEditableProductDraft,
  InstagramFieldConfidence,
  InstagramImportReviewData,
} from "./types"

type ReviewAction = "attach" | "discard" | "draft" | "publish" | "save" | null

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown date"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date)
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100)
  const label = percent >= 85 ? "High" : percent >= 60 ? "Check" : "Low"
  return (
    <Badge
      className={cn(
        "font-normal",
        percent >= 85 && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        percent >= 60 && percent < 85 && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
        percent < 60 && "bg-destructive/10 text-destructive",
      )}
      variant="secondary"
    >
      {label} · {percent}%
    </Badge>
  )
}

function FieldHeading({
  confidence,
  label,
  optional = false,
}: {
  confidence?: InstagramFieldConfidence
  label: string
  optional?: boolean
}) {
  return (
    <span className="flex flex-wrap items-center justify-between gap-2">
      <span>{label}{optional ? <span className="font-normal text-muted-foreground"> (optional)</span> : null}</span>
      {confidence ? <ConfidenceBadge confidence={confidence.confidence} /> : null}
    </span>
  )
}

function Evidence({ confidence }: { confidence?: InstagramFieldConfidence }) {
  if (!confidence) return null
  if (!confidence.evidence) {
    return <span className="text-xs font-normal text-amber-700 dark:text-amber-400">Not found in the caption — enter this manually.</span>
  }
  return <span className="line-clamp-1 text-xs font-normal text-muted-foreground">Found from: “{confidence.evidence}”</span>
}

function validDraft(draft: InstagramEditableProductDraft) {
  const sellingPrice = Number(draft.sellingPrice)
  const stockQuantity = Number(draft.stockQuantity)
  return Boolean(
    draft.name.trim()
    && draft.categoryId
    && draft.sellingPrice.trim()
    && Number.isFinite(sellingPrice)
    && sellingPrice > 0
    && draft.stockQuantity.trim()
    && Number.isFinite(stockQuantity)
    && stockQuantity >= 0,
  )
}

export function InstagramImportReview({ data }: { data: InstagramImportReviewData }) {
  const router = useRouter()
  const [draft, setDraft] = useState(data.draft)
  const [reviewConfirmed, setReviewConfirmed] = useState(false)
  const [pendingAction, setPendingAction] = useState<ReviewAction>(null)
  const [dirty, setDirty] = useState(false)
  const canApprove = useMemo(() => validDraft(draft), [draft])
  const MediaIcon = data.source.mediaType === "image"
    ? ImageIcon
    : data.source.mediaType === "carousel"
      ? Layers3
      : Play

  function setField<Key extends InstagramDraftField>(key: Key, value: InstagramEditableProductDraft[Key]) {
    setDirty(true)
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function submitAction(action: Exclude<ReviewAction, "attach" | null>, publish = false) {
    if (pendingAction) return
    if ((action === "draft" || action === "publish") && (!canApprove || !reviewConfirmed)) {
      toast.error("Complete the required fields and confirm that you reviewed the product.")
      return
    }
    if (action === "discard" && !window.confirm("Discard this Instagram import? Its source record will remain in the import history.")) return

    setPendingAction(action)
    const response = await postJson<{ productId?: string }>(
      `/api/integrations/instagram/imports/${data.id}`,
      action === "save"
        ? { action: "save", draft }
        : action === "discard"
          ? { action: "discard" }
          : {
              action: "approve",
              confirmCreateNew: data.duplicateCandidates.length > 0,
              draft,
              publish,
            },
    )
    setPendingAction(null)
    if (!response.ok) {
      toast.error(response.error.message)
      return
    }

    if (action === "save") {
      setDirty(false)
      toast.success(response.message ?? "Instagram draft saved.")
      return
    }
    if (action === "discard") {
      toast.success(response.message ?? "Instagram import discarded.")
      router.push("/app/marketing/instagram")
      router.refresh()
      return
    }

    toast.success(response.message ?? (publish ? "Product approved and published." : "Product added to catalogue drafts."))
    if (response.data.productId) router.push(`/app/catalogue/${response.data.productId}`)
    else router.push("/app/marketing/instagram")
    router.refresh()
  }

  async function attach(productId: string) {
    if (pendingAction) return
    setPendingAction("attach")
    const response = await postJson<Record<string, never>>(
      `/api/integrations/instagram/imports/${data.id}`,
      { action: "attach", productId },
    )
    setPendingAction(null)
    if (!response.ok) {
      toast.error(response.error.message)
      return
    }
    toast.success(response.message ?? "Instagram post attached to the existing product.")
    router.push("/app/marketing/instagram")
    router.refresh()
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submitAction("save")
  }

  const fieldClass = "grid gap-2 text-sm font-medium"

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link className="transition-colors hover:text-foreground" href="/app/marketing/instagram">Instagram imports</Link>
            <span aria-hidden="true">/</span>
            <span>Review draft</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Review product details</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Edit every suggestion before this post becomes a catalogue product.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.isPreview ? <Badge variant="outline">Preview data</Badge> : null}
          <ButtonLink href="/app/marketing/instagram" variant="outline"><ArrowLeft aria-hidden="true" />Back to imports</ButtonLink>
        </div>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
        <div>
          <p className="font-medium">You stay in control</p>
          <p className="mt-1 leading-6 text-muted-foreground">Caption rules only provide suggestions. Carborony will not create or publish a product until you explicitly approve it below.</p>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-24">
          <Card className="gap-0 overflow-hidden py-0">
            <div
              className="relative flex aspect-square items-center justify-center bg-[linear-gradient(145deg,#312e81,#a21caf_48%,#fb923c)] text-white"
              style={data.source.mediaUrl ? {
                backgroundImage: `linear-gradient(rgba(15,23,42,.08),rgba(15,23,42,.25)),url(${JSON.stringify(data.source.mediaUrl)})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
              } : undefined}
            >
              {!data.source.mediaUrl ? <MediaIcon aria-hidden="true" className="size-12 opacity-90" /> : null}
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium capitalize backdrop-blur">
                <InstagramIcon aria-hidden="true" className="size-3.5" /> {data.source.mediaType}
              </span>
            </div>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">@{data.connectionUsername}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(data.source.publishedAt)}</p>
                </div>
                <a className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" href={data.source.permalink} rel="noreferrer" target="_blank">
                  View post <ExternalLink aria-hidden="true" className="size-3" />
                </a>
              </div>
              <div className="mt-4 rounded-xl bg-muted/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Original caption</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{data.source.caption || "This post has no caption."}</p>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">The original caption is preserved as source evidence and cannot be edited here.</p>
            </CardContent>
          </Card>

          {data.duplicateCandidates.length ? (
            <Card className="border-orange-500/20 bg-orange-500/5">
              <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2"><CircleAlert aria-hidden="true" className="size-4 text-orange-600" />Possible duplicate</CardTitle>
                <CardDescription>Compare before creating another product.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {data.duplicateCandidates.map((candidate) => (
                  <div className="rounded-lg border bg-background p-3" key={candidate.productId}>
                    <div className="flex items-start justify-between gap-2">
                      <div><p className="font-medium">{candidate.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{Math.round(candidate.score * 100)}% similarity</p></div>
                      <Button disabled={!data.canManage || Boolean(pendingAction)} onClick={() => attach(candidate.productId)} size="sm" variant="outline">
                        {pendingAction === "attach" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}Attach
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </aside>

        <form className="min-w-0 space-y-4" noValidate onSubmit={save}>
          <Card>
            <CardHeader>
              <CardTitle as="h2">Product information</CardTitle>
              <CardDescription>Review the suggested values and edit anything that does not accurately describe the product.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <label className={cn(fieldClass, "md:col-span-2")}>
                <FieldHeading confidence={data.fieldConfidence.name} label="Product name" />
                <Input disabled={!data.canManage || Boolean(pendingAction)} maxLength={160} onValueChange={(value) => setField("name", value)} placeholder="Enter the product name" value={draft.name} />
                <Evidence confidence={data.fieldConfidence.name} />
              </label>
              <label className={fieldClass}>
                <FieldHeading confidence={data.fieldConfidence.categoryId} label="Category" />
                <select
                  className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                  disabled={!data.canManage || Boolean(pendingAction)}
                  onChange={(event) => setField("categoryId", event.currentTarget.value)}
                  value={draft.categoryId}
                >
                  <option value="">Select a category</option>
                  {data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                <Evidence confidence={data.fieldConfidence.categoryId} />
              </label>
              <label className={fieldClass}>
                <FieldHeading confidence={data.fieldConfidence.brand} label="Brand" optional />
                <Input disabled={!data.canManage || Boolean(pendingAction)} maxLength={100} onValueChange={(value) => setField("brand", value)} placeholder="e.g. Your Store" value={draft.brand} />
                <Evidence confidence={data.fieldConfidence.brand} />
              </label>
              <label className={cn(fieldClass, "md:col-span-2")}>
                <FieldHeading confidence={data.fieldConfidence.description} label="Description" optional />
                <Textarea disabled={!data.canManage || Boolean(pendingAction)} maxLength={3000} onChange={(event) => setField("description", event.currentTarget.value)} placeholder="Describe materials, fit, care, delivery, or other useful details" value={draft.description} />
                <Evidence confidence={data.fieldConfidence.description} />
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Pricing and stock</CardTitle>
              <CardDescription>Required values must be confirmed manually before approval.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <label className={fieldClass}>
                <FieldHeading confidence={data.fieldConfidence.sellingPrice} label={`Selling price (${data.businessCurrency})`} />
                <Input disabled={!data.canManage || Boolean(pendingAction)} inputMode="decimal" min="0" onValueChange={(value) => setField("sellingPrice", value)} placeholder="0.00" step="0.01" type="number" value={draft.sellingPrice} />
                <Evidence confidence={data.fieldConfidence.sellingPrice} />
              </label>
              <label className={fieldClass}>
                <FieldHeading confidence={data.fieldConfidence.discountPrice} label={`Discount price (${data.businessCurrency})`} optional />
                <Input disabled={!data.canManage || Boolean(pendingAction)} inputMode="decimal" min="0" onValueChange={(value) => setField("discountPrice", value)} placeholder="Leave blank if none" step="0.01" type="number" value={draft.discountPrice} />
                <Evidence confidence={data.fieldConfidence.discountPrice} />
              </label>
              <label className={fieldClass}>
                <FieldHeading confidence={data.fieldConfidence.stockQuantity} label="Stock quantity" />
                <Input disabled={!data.canManage || Boolean(pendingAction)} inputMode="numeric" min="0" onValueChange={(value) => setField("stockQuantity", value)} placeholder="Enter available stock" step="1" type="number" value={draft.stockQuantity} />
                <Evidence confidence={data.fieldConfidence.stockQuantity} />
              </label>
              <label className={fieldClass}>
                <FieldHeading confidence={data.fieldConfidence.sku} label="SKU" optional />
                <Input disabled={!data.canManage || Boolean(pendingAction)} maxLength={80} onValueChange={(value) => setField("sku", value)} placeholder="e.g. BAG-TOTE-001" value={draft.sku} />
                <Evidence confidence={data.fieldConfidence.sku} />
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Options and discovery</CardTitle>
              <CardDescription>Use comma-separated values. Full variant combinations can be completed later in Catalogue.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <label className={fieldClass}>
                <FieldHeading confidence={data.fieldConfidence.colours} label="Colours" optional />
                <Input disabled={!data.canManage || Boolean(pendingAction)} onValueChange={(value) => setField("colours", value)} placeholder="Brown, Black" value={draft.colours} />
                <Evidence confidence={data.fieldConfidence.colours} />
              </label>
              <label className={fieldClass}>
                <FieldHeading confidence={data.fieldConfidence.sizes} label="Sizes" optional />
                <Input disabled={!data.canManage || Boolean(pendingAction)} onValueChange={(value) => setField("sizes", value)} placeholder="Small, Medium, Large" value={draft.sizes} />
                <Evidence confidence={data.fieldConfidence.sizes} />
              </label>
              <label className={cn(fieldClass, "md:col-span-2")}>
                <FieldHeading confidence={data.fieldConfidence.tags} label="Tags" optional />
                <Input disabled={!data.canManage || Boolean(pendingAction)} onValueChange={(value) => setField("tags", value)} placeholder="leather, tote, new arrival" value={draft.tags} />
                <Evidence confidence={data.fieldConfidence.tags} />
              </label>
            </CardContent>
          </Card>

          {!canApprove ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <p><strong className="font-medium">More information is required.</strong> Add a product name, category, valid selling price, and stock quantity before approval.</p>
            </div>
          ) : null}

          <Card className="border-primary/20 bg-primary/[0.025]">
            <CardContent className="space-y-4">
              <label className="flex items-start gap-3 rounded-xl border bg-background p-3.5 text-sm">
                <input
                  checked={reviewConfirmed}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                  disabled={!data.canManage || Boolean(pendingAction)}
                  onChange={(event) => setReviewConfirmed(event.currentTarget.checked)}
                  type="checkbox"
                />
                <span><strong className="block font-medium">I reviewed the Instagram suggestion</strong><span className="mt-0.5 block leading-5 text-muted-foreground">The product name, category, price, stock, options, and description accurately represent what I sell.</span></span>
              </label>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button disabled={!data.canManage || Boolean(pendingAction)} type="submit" variant="outline">
                    {pendingAction === "save" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
                    Save review
                  </Button>
                  <Button disabled={!data.canManage || Boolean(pendingAction)} onClick={() => void submitAction("discard")} type="button" variant="ghost">
                    {pendingAction === "discard" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Trash2 aria-hidden="true" />}
                    Discard
                  </Button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button disabled={!data.canManage || Boolean(pendingAction) || !canApprove || !reviewConfirmed} onClick={() => void submitAction("draft", false)} type="button" variant="secondary">
                    {pendingAction === "draft" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <PackageCheck aria-hidden="true" />}
                    {data.duplicateCandidates.length ? "Create new catalogue draft" : "Add as catalogue draft"}
                  </Button>
                  <Button disabled={!data.canManage || Boolean(pendingAction) || !canApprove || !reviewConfirmed} onClick={() => void submitAction("publish", true)} type="button">
                    {pendingAction === "publish" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <CheckCircle2 aria-hidden="true" />}
                    {data.duplicateCandidates.length ? "Create new & publish" : "Approve & publish"}
                  </Button>
                </div>
              </div>
              {dirty ? <p className="text-xs text-amber-700 dark:text-amber-400">You have unsaved edits.</p> : null}
            </CardContent>
          </Card>

          {!data.canManage ? <p className="text-sm text-muted-foreground">You have read-only access. Ask someone with product-management access to complete this review.</p> : null}
        </form>
      </div>
    </div>
  )
}
