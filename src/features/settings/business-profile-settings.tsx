"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { ExternalLink, LoaderCircle, Save, Store } from "lucide-react"
import { toast } from "sonner"

import { Button, ButtonLink } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { postJson } from "@/lib/api/client"
import { businessCategories, weekDays } from "./options"
import { businessProfileSettingsSchema, type BusinessProfileSettingsInput } from "./schemas"
import { SettingsImagePicker } from "./settings-image-picker"
import type { SettingsMutationData, SettingsPageData } from "./types"

type BusinessData = NonNullable<SettingsPageData["business"]>
type Draft = Omit<BusinessProfileSettingsInput, "logo"> & {
  logo: BusinessProfileSettingsInput["logo"]
}

export function BusinessProfileSettings({
  business,
  canManage,
}: {
  business: BusinessData
  canManage: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [logoUrl, setLogoUrl] = useState(business.logoUrl)
  const [draft, setDraft] = useState<Draft>({
    address: business.address ?? "",
    categoryCode: business.categoryCode as Draft["categoryCode"],
    description: business.description ?? "",
    email: business.email ?? "",
    facebookPage: business.facebookPage ?? "",
    instagramAccount: business.instagramAccount ?? "",
    logo: { action: "keep" },
    name: business.name,
    openingHours: business.openingHours as Draft["openingHours"],
    phone: business.phone,
    websiteUrl: business.websiteUrl ?? "",
    whatsappPhone: business.whatsappPhone ?? "",
  })

  function update<Key extends keyof Draft>(key: Key, value: Draft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function updateHours(index: number, changes: Partial<Draft["openingHours"][number]>) {
    update("openingHours", draft.openingHours.map((hours, hoursIndex) =>
      hoursIndex === index ? { ...hours, ...changes } : hours,
    ))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !canManage) return
    const validation = businessProfileSettingsSchema.safeParse(draft)
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? "Check the business profile.")
      return
    }
    setPending(true)
    const response = await postJson<SettingsMutationData>("/api/settings/business", validation.data)
    setPending(false)
    if (!response.ok) return toast.error(response.error.message)
    if (response.data.logoUrl !== undefined) setLogoUrl(response.data.logoUrl)
    setDraft((current) => ({ ...current, logo: { action: "keep" } }))
    toast.success(response.message ?? "Business profile updated.")
    router.refresh()
  }

  const disabled = pending || !canManage
  const fieldClass = "grid gap-1.5 text-sm font-medium"

  return (
    <form className="grid gap-5" onSubmit={submit}>
      {!canManage ? <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground"><strong className="text-foreground">Read-only access.</strong> You can view these details, but a business administrator must make changes.</div> : null}
      <Card>
        <CardHeader><CardTitle as="h2">Business identity</CardTitle><CardDescription>Core information used across your workspace, invoices, receipts, and storefront.</CardDescription></CardHeader>
        <CardContent className="grid gap-5">
          <SettingsImagePicker disabled={disabled} initialUrl={logoUrl} label="Business logo" onChange={(logo, previewUrl) => { update("logo", logo); setLogoUrl(previewUrl) }} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={fieldClass}>Business name<Input autoComplete="organization" disabled={disabled} maxLength={120} onChange={(event) => update("name", event.currentTarget.value)} value={draft.name} /></label>
            <label className={fieldClass}>Business category<select className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm disabled:opacity-50" disabled={disabled} onChange={(event) => update("categoryCode", event.currentTarget.value as Draft["categoryCode"])} value={draft.categoryCode}>{businessCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <label className={fieldClass}>Business description <span className="font-normal text-muted-foreground">(optional)</span><Textarea disabled={disabled} maxLength={1000} onChange={(event) => update("description", event.currentTarget.value)} rows={4} value={draft.description ?? ""} /></label>
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">Public storefront address</p><p className="mt-1 break-all text-xs text-muted-foreground">/store/{business.slug}</p></div><ButtonLink href={`/store/${business.slug}?preview=1`} target="_blank" variant="outline"><Store aria-hidden="true" />Preview store<ExternalLink aria-hidden="true" /></ButtonLink></div>
            <p className="mt-3 text-xs text-muted-foreground">The storefront address is read-only here to avoid breaking customer links.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle as="h2">Contact details</CardTitle><CardDescription>Shown on business documents and used as your operational contact information.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className={fieldClass}>Business phone<Input autoComplete="tel" disabled={disabled} maxLength={24} onChange={(event) => update("phone", event.currentTarget.value)} type="tel" value={draft.phone} /></label>
          <label className={fieldClass}>Business email <span className="font-normal text-muted-foreground">(optional)</span><Input autoComplete="email" disabled={disabled} maxLength={254} onChange={(event) => update("email", event.currentTarget.value)} type="email" value={draft.email ?? ""} /></label>
          <label className={fieldClass}>Website <span className="font-normal text-muted-foreground">(optional)</span><Input autoComplete="url" disabled={disabled} maxLength={2048} onChange={(event) => update("websiteUrl", event.currentTarget.value)} placeholder="https://example.com" type="url" value={draft.websiteUrl ?? ""} /></label>
          <label className={fieldClass}>WhatsApp number <span className="font-normal text-muted-foreground">(optional)</span><Input autoComplete="tel" disabled={disabled} maxLength={32} onChange={(event) => update("whatsappPhone", event.currentTarget.value)} type="tel" value={draft.whatsappPhone ?? ""} /></label>
          <label className={`${fieldClass} sm:col-span-2`}>Business address <span className="font-normal text-muted-foreground">(optional)</span><Textarea autoComplete="street-address" disabled={disabled} maxLength={500} onChange={(event) => update("address", event.currentTarget.value)} rows={3} value={draft.address ?? ""} /></label>
          <label className={fieldClass}>Instagram <span className="font-normal text-muted-foreground">(optional)</span><Input disabled={disabled} maxLength={255} onChange={(event) => update("instagramAccount", event.currentTarget.value)} placeholder="@yourbusiness" value={draft.instagramAccount ?? ""} /></label>
          <label className={fieldClass}>Facebook <span className="font-normal text-muted-foreground">(optional)</span><Input disabled={disabled} maxLength={255} onChange={(event) => update("facebookPage", event.currentTarget.value)} placeholder="facebook.com/yourbusiness" value={draft.facebookPage ?? ""} /></label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle as="h2">Opening hours</CardTitle><CardDescription>Keep your weekly availability accurate for customers and staff.</CardDescription></CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border">
            {draft.openingHours.map((hours, index) => (
              <div className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[160px_1fr]" key={hours.day}>
                <label className="flex items-center gap-3 text-sm font-medium"><input checked={hours.enabled} className="size-4 accent-primary" disabled={disabled} onChange={(event) => updateHours(index, { enabled: event.currentTarget.checked })} type="checkbox" />{weekDays.find(([day]) => day === hours.day)?.[1] ?? hours.day}</label>
                {hours.enabled ? <div className="col-span-2 flex items-center gap-2 sm:col-span-1"><Input aria-label={`${hours.day} opening time`} disabled={disabled} onChange={(event) => updateHours(index, { open: event.currentTarget.value })} type="time" value={hours.open} /><span className="text-sm text-muted-foreground">to</span><Input aria-label={`${hours.day} closing time`} disabled={disabled} onChange={(event) => updateHours(index, { close: event.currentTarget.value })} type="time" value={hours.close} /></div> : <span className="text-sm text-muted-foreground">Closed</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {canManage ? <div className="sticky bottom-4 z-10 flex justify-end rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur"><Button disabled={pending} size="lg" type="submit">{pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}{pending ? "Saving…" : "Save business profile"}</Button></div> : null}
    </form>
  )
}
