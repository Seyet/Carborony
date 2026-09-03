"use client"

import { useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, Clock3, Globe2, LoaderCircle, Save, WalletCards } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { postJson } from "@/lib/api/client"
import {
  countries,
  currencies,
  dateFormats,
  locales,
  timeFormats,
  timeZones,
  weekStartDays,
} from "./options"
import { regionalSettingsSchema, type RegionalSettingsInput } from "./schemas"
import type { SettingsMutationData, SettingsPageData } from "./types"

type RegionalData = NonNullable<SettingsPageData["regional"]>

function datePreview(input: RegionalSettingsInput) {
  const date = new Date("2026-09-02T15:45:00Z")
  const parts = new Intl.DateTimeFormat(input.locale, {
    day: "2-digit",
    month: "2-digit",
    timeZone: input.timezone,
    year: "numeric",
  }).formatToParts(date)
  const values = new Map(parts.map((part) => [part.type, part.value]))
  const ordered = input.dateFormat === "month_day_year"
    ? [values.get("month"), values.get("day"), values.get("year")]
    : input.dateFormat === "year_month_day"
      ? [values.get("year"), values.get("month"), values.get("day")]
      : [values.get("day"), values.get("month"), values.get("year")]
  return ordered.join("/")
}

export function RegionalSettings({
  canManage,
  isOwner,
  regional,
}: {
  canManage: boolean
  isOwner: boolean
  regional: RegionalData
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [draft, setDraft] = useState<RegionalSettingsInput>({
    ...regional,
    countryCode: regional.countryCode as RegionalSettingsInput["countryCode"],
    currencyCode: regional.currencyCode as RegionalSettingsInput["currencyCode"],
    locale: regional.locale as RegionalSettingsInput["locale"],
  })
  const [savedCurrency, setSavedCurrency] = useState(regional.currencyCode)
  const disabled = pending || !canManage
  const currencyChanged = draft.currencyCode !== savedCurrency
  const preview = useMemo(() => {
    try {
      const example = new Date("2026-09-02T15:45:00Z")
      return {
        currency: new Intl.NumberFormat(draft.locale, { currency: draft.currencyCode, currencyDisplay: "narrowSymbol", style: "currency" }).format(125000.5),
        date: datePreview(draft),
        number: new Intl.NumberFormat(draft.locale, { maximumFractionDigits: 2 }).format(125000.5),
        time: new Intl.DateTimeFormat(draft.locale, { hour: "numeric", hour12: draft.timeFormat === "12h", minute: "2-digit", timeZone: draft.timezone }).format(example),
      }
    } catch {
      return { currency: "—", date: "—", number: "—", time: "—" }
    }
  }, [draft])

  function update<Key extends keyof RegionalSettingsInput>(key: Key, value: RegionalSettingsInput[Key]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled) return
    const validation = regionalSettingsSchema.safeParse(draft)
    if (!validation.success) return toast.error(validation.error.issues[0]?.message)
    if (currencyChanged && !window.confirm(`Change the business currency from ${savedCurrency} to ${draft.currencyCode}? Historical transactions will keep their recorded currency, but catalogue prices are not converted.`)) return
    setPending(true)
    const response = await postJson<SettingsMutationData>("/api/settings/regional", validation.data)
    setPending(false)
    if (!response.ok) return toast.error(response.error.message)
    setSavedCurrency(draft.currencyCode)
    toast.success(response.message ?? "Regional settings updated.")
    router.refresh()
  }

  const fieldClass = "grid gap-1.5 text-sm font-medium"
  const selectClass = "h-9 rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50"
  const knownTimezone = timeZones.some(([value]) => value === draft.timezone)

  return (
    <form className="grid gap-5" onSubmit={submit}>
      {!canManage ? <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground"><strong className="text-foreground">Read-only access.</strong> You can view regional settings, but a business administrator must make changes.</div> : null}
      <Card>
        <CardHeader><CardTitle as="h2">Country and timezone</CardTitle><CardDescription>These settings determine business-day boundaries across dashboards, orders, reports, expenses, and activity.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className={fieldClass}>Country<select className={selectClass} disabled={disabled} onChange={(event) => update("countryCode", event.currentTarget.value as RegionalSettingsInput["countryCode"])} value={draft.countryCode}>{countries.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className={fieldClass}>Timezone<select className={selectClass} disabled={disabled} onChange={(event) => update("timezone", event.currentTarget.value)} value={draft.timezone}>{!knownTimezone ? <option value={draft.timezone}>{draft.timezone}</option> : null}{timeZones.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className={fieldClass}>First day of the week<select className={selectClass} disabled={disabled} onChange={(event) => update("weekStartsOn", Number(event.currentTarget.value))} value={draft.weekStartsOn}>{weekStartDays.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle as="h2">Currency</CardTitle><CardDescription>The business currency is used for catalogue prices and all new transactions.</CardDescription></CardHeader>
        <CardContent className="grid gap-4">
          <label className={fieldClass}>Business currency<select className={selectClass} disabled={disabled || !isOwner} onChange={(event) => update("currencyCode", event.currentTarget.value as RegionalSettingsInput["currencyCode"])} value={draft.currencyCode}>{currencies.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {!isOwner ? <p className="text-xs text-muted-foreground">Only the business owner can change currency.</p> : null}
          {currencyChanged ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200"><strong>Catalogue prices will not be converted.</strong> Historical sales, orders, and expenses retain their stored currency, while current product prices will be interpreted in {draft.currencyCode}.</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle as="h2">Display formats</CardTitle><CardDescription>Control how dates, times, numbers, and money are presented.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className={fieldClass}>Formatting locale<select className={selectClass} disabled={disabled} onChange={(event) => update("locale", event.currentTarget.value as RegionalSettingsInput["locale"])} value={draft.locale}>{locales.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className={fieldClass}>Date format<select className={selectClass} disabled={disabled} onChange={(event) => update("dateFormat", event.currentTarget.value as RegionalSettingsInput["dateFormat"])} value={draft.dateFormat}>{dateFormats.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className={fieldClass}>Time format<select className={selectClass} disabled={disabled} onChange={(event) => update("timeFormat", event.currentTarget.value as RegionalSettingsInput["timeFormat"])} value={draft.timeFormat}>{timeFormats.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </CardContent>
      </Card>

      <Card className="bg-foreground text-background ring-0">
        <CardHeader><CardTitle as="h2">Formatting preview</CardTitle><CardDescription className="text-background/65">Examples update as you change the settings above.</CardDescription></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[{ icon: CalendarDays, label: "Date", value: preview.date }, { icon: Clock3, label: "Time", value: preview.time }, { icon: Globe2, label: "Number", value: preview.number }, { icon: WalletCards, label: "Currency", value: preview.currency }].map(({ icon: Icon, label, value }) => <div className="rounded-xl bg-background/10 p-4" key={label}><Icon aria-hidden="true" className="size-4 text-background/65" /><p className="mt-3 text-xs text-background/65">{label}</p><p className="mt-1 font-semibold tabular-nums">{value}</p></div>)}
        </CardContent>
      </Card>

      {canManage ? <div className="sticky bottom-4 z-10 flex justify-end rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur"><Button disabled={pending} size="lg" type="submit">{pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}{pending ? "Saving…" : "Save regional settings"}</Button></div> : null}
    </form>
  )
}
