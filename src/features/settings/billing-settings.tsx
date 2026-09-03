"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  LoaderCircle,
  Mail,
  Save,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { postJson } from "@/lib/api/client"
import { formatBusinessDate, formatBusinessMoney } from "@/lib/formatting"
import { cn } from "@/lib/utils"
import { billingContactSettingsSchema } from "./schemas"
import type { SettingsMutationData, SettingsPageData } from "./types"

type BillingData = NonNullable<SettingsPageData["billing"]>

const subscriptionStatus = {
  active: { className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", label: "Active" },
  cancelled: { className: "", label: "Cancelled" },
  past_due: { className: "bg-destructive/10 text-destructive", label: "Past due" },
  paused: { className: "bg-amber-500/10 text-amber-800 dark:text-amber-300", label: "Paused" },
  trialing: { className: "bg-blue-500/10 text-blue-700 dark:text-blue-300", label: "Trial" },
} as const

const invoiceStatus = {
  draft: { className: "", label: "Draft" },
  open: { className: "bg-blue-500/10 text-blue-700 dark:text-blue-300", label: "Open" },
  paid: { className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", label: "Paid" },
  uncollectible: { className: "bg-destructive/10 text-destructive", label: "Uncollectible" },
  void: { className: "", label: "Void" },
} as const

function planName(code: string) {
  return code.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
}

function dateLabel(value: string, data: SettingsPageData) {
  if (!data.regional) {
    return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value))
  }
  return formatBusinessDate(value, {
    dateFormat: data.regional.dateFormat,
    locale: data.regional.locale,
    timeFormat: data.regional.timeFormat,
    timeZone: data.regional.timezone,
  })
}

export function BillingSettings({ data, billing }: { data: SettingsPageData; billing: BillingData }) {
  const router = useRouter()
  const [billingEmail, setBillingEmail] = useState(billing.billingEmail)
  const [savedEmail, setSavedEmail] = useState(billing.billingEmail)
  const [pending, setPending] = useState(false)
  const status = subscriptionStatus[billing.subscriptionStatus]
  const isFree = billing.planCode === "free" && billing.planAmount === 0
  const amount = formatBusinessMoney(
    billing.planAmount,
    billing.currencyCode,
    data.regional?.locale ?? "en-NG",
  )

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const validation = billingContactSettingsSchema.safeParse({ billingEmail })
    if (!validation.success) return toast.error(validation.error.issues[0]?.message)
    setPending(true)
    const response = await postJson<SettingsMutationData>("/api/settings/billing", validation.data)
    setPending(false)
    if (!response.ok) return toast.error(response.error.message)
    setBillingEmail(validation.data.billingEmail)
    setSavedEmail(validation.data.billingEmail)
    toast.success(response.message ?? "Billing contact updated.")
    router.refresh()
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="bg-foreground text-background ring-0 xl:col-span-2">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><CardTitle as="h2" className="text-lg">{planName(billing.planCode)} plan</CardTitle><CardDescription className="mt-1 text-background/65">Your current Carborony workspace subscription.</CardDescription></div>
            <Badge className={cn("border-0", status.className)} variant="secondary">{status.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-background/10 p-4"><CreditCard aria-hidden="true" className="size-4 text-background/65" /><p className="mt-3 text-xs text-background/65">Plan cost</p><p className="mt-1 text-lg font-semibold tabular-nums">{isFree ? "Free" : amount}</p>{billing.billingInterval ? <p className="mt-0.5 text-xs text-background/65">per {billing.billingInterval === "monthly" ? "month" : "year"}</p> : null}</div>
          <div className="rounded-xl bg-background/10 p-4"><CalendarClock aria-hidden="true" className="size-4 text-background/65" /><p className="mt-3 text-xs text-background/65">Next billing date</p><p className="mt-1 font-semibold">{billing.currentPeriodEndsAt ? dateLabel(billing.currentPeriodEndsAt, data) : "No renewal"}</p></div>
          <div className="rounded-xl bg-background/10 p-4"><ShieldCheck aria-hidden="true" className="size-4 text-background/65" /><p className="mt-3 text-xs text-background/65">Billing access</p><p className="mt-1 font-semibold">Owner only</p></div>
        </CardContent>
        {billing.cancelAtPeriodEnd && billing.currentPeriodEndsAt ? <div className="mx-4 rounded-xl bg-amber-400/15 p-3 text-sm text-amber-100">This subscription will end on {dateLabel(billing.currentPeriodEndsAt, data)}.</div> : null}
      </Card>

      <Card>
        <CardHeader><CardTitle as="h2" className="flex items-center gap-2"><Mail aria-hidden="true" className="size-4" />Billing contact</CardTitle><CardDescription>Receipts and subscription notices are sent to this address.</CardDescription></CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={saveContact}>
            <label className="grid gap-1.5 text-sm font-medium">Billing email<Input autoComplete="email" disabled={pending} maxLength={254} onChange={(event) => setBillingEmail(event.currentTarget.value)} required type="email" value={billingEmail} /></label>
            <Button className="justify-self-start" disabled={pending || billingEmail.trim().toLowerCase() === savedEmail} type="submit">{pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}Save billing contact</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle as="h2" className="flex items-center gap-2"><CreditCard aria-hidden="true" className="size-4" />Payment method</CardTitle><CardDescription>The payment method used for subscription renewals.</CardDescription></CardHeader>
        <CardContent>
          {billing.paymentMethod ? <div className="flex items-center gap-3 rounded-xl border p-4"><span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><CreditCard aria-hidden="true" className="size-5" /></span><div><p className="text-sm font-medium capitalize">{billing.paymentMethod.brand} ending in {billing.paymentMethod.lastFour}</p><p className="mt-0.5 text-xs text-muted-foreground">Expires {String(billing.paymentMethod.expiryMonth).padStart(2, "0")}/{billing.paymentMethod.expiryYear}</p></div></div> : <div className="rounded-xl border border-dashed bg-muted/20 p-5 text-center"><CheckCircle2 aria-hidden="true" className="mx-auto size-6 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No payment method required</p><p className="mt-1 text-xs text-muted-foreground">A payment method will appear here when a paid plan is activated.</p></div>}
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader><CardTitle as="h2" className="flex items-center gap-2"><FileText aria-hidden="true" className="size-4" />Billing history</CardTitle><CardDescription>Your 25 most recent subscription invoices.</CardDescription></CardHeader>
        <CardContent className="px-0">
          {billing.invoices.length ? <div className="divide-y border-t">{billing.invoices.map((invoice) => { const currentStatus = invoiceStatus[invoice.status]; return <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6" key={invoice.id}><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{invoice.invoiceNumber}</p><p className="mt-0.5 text-xs text-muted-foreground">Issued {dateLabel(invoice.issuedAt, data)}</p></div><div className="flex items-center justify-between gap-4 sm:justify-end"><Badge className={currentStatus.className} variant="secondary">{currentStatus.label}</Badge><p className="min-w-24 text-right text-sm font-semibold tabular-nums">{formatBusinessMoney(invoice.amountDue, invoice.currencyCode, data.regional?.locale ?? "en-NG")}</p>{invoice.hostedInvoiceUrl ? <a aria-label={`Download invoice ${invoice.invoiceNumber}`} className="inline-flex size-8 items-center justify-center rounded-lg border transition hover:bg-muted" href={invoice.hostedInvoiceUrl} rel="noreferrer" target="_blank"><Download aria-hidden="true" className="size-4" /></a> : <span className="size-8" />}</div></div> })}</div> : <div className="border-t px-6 py-10 text-center"><FileText aria-hidden="true" className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No invoices yet</p><p className="mt-1 text-xs text-muted-foreground">Subscription invoices will be available here after your first charge.</p></div>}
        </CardContent>
      </Card>
    </div>
  )
}
