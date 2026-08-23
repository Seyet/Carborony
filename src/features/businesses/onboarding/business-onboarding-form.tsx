"use client"

import { type ChangeEvent, type FormEvent, useMemo, useState } from "react"
import { ImagePlus, LoaderCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { BusinessOnboardingData } from "./api-types"
import { businessCategories, countries, currencies, weekDays } from "./options"
import {
  businessOnboardingSchema,
  type BusinessOnboardingRequest,
} from "./schemas"
import { postJson } from "@/lib/api/client"
import { cn } from "@/lib/utils"

type OpeningHour = BusinessOnboardingRequest["openingHours"][number]
type BusinessOnboardingFormValues = Omit<
  BusinessOnboardingRequest,
  "categoryCode" | "countryCode" | "currencyCode"
> & {
  categoryCode: string
  countryCode: string
  currencyCode: string
}

export type BusinessOnboardingInitialValues = Omit<
  BusinessOnboardingFormValues,
  "logo" | "openingHours"
> & {
  hasLogo: boolean
  openingHours: OpeningHour[]
}

const defaultHours: OpeningHour[] = weekDays.map(([day], index) => ({
  close: "17:00",
  day,
  enabled: index < 5,
  open: "09:00",
}))

function FieldLabel({ children, optional = false }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <span className="text-sm font-medium">
      {children}{optional ? <span className="ml-1 font-normal text-muted-foreground">(optional)</span> : null}
    </span>
  )
}

export function BusinessOnboardingForm({ initialValues }: { initialValues: BusinessOnboardingInitialValues }) {
  const [values, setValues] = useState<BusinessOnboardingFormValues>({
    ...initialValues,
    logo: null,
    openingHours: initialValues.openingHours.length === 7
      ? initialValues.openingHours
      : defaultHours,
  })
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [logoError, setLogoError] = useState<string>()
  const [logoName, setLogoName] = useState(initialValues.hasLogo ? "Existing logo saved" : "")
  const [pending, setPending] = useState(false)
  const validation = useMemo(() => businessOnboardingSchema.safeParse(values), [values])

  function fieldError(name: string) {
    if (!touched[name] || validation.success) return undefined
    return validation.error.issues.find((issue) => issue.path[0] === name)?.message
  }

  function setField(name: keyof BusinessOnboardingFormValues, value: string) {
    setTouched((current) => ({ ...current, [name]: true }))
    setValues((current) => ({ ...current, [name]: value }))
  }

  function renderInput(name: keyof BusinessOnboardingFormValues, label: string, options: React.ComponentProps<"input"> & { optional?: boolean } = {}) {
    const error = fieldError(name)
    const { optional, ...inputOptions } = options
    return (
      <label className="grid gap-2">
        <FieldLabel optional={optional}>{label}</FieldLabel>
        <Input
          {...inputOptions}
          aria-invalid={Boolean(error) || undefined}
          className="h-11"
          onChange={(event) => setField(name, event.currentTarget.value)}
          required={!optional}
          value={String(values[name] ?? "")}
        />
        {error ? <span className="text-xs text-destructive" role="alert">{error}</span> : null}
      </label>
    )
  }

  function renderSelect(name: "categoryCode" | "countryCode" | "currencyCode", label: string, options: readonly (readonly [string, string])[]) {
    const error = fieldError(name)
    return (
      <label className="grid gap-2">
        <FieldLabel>{label}</FieldLabel>
        <select
          aria-invalid={Boolean(error) || undefined}
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
          onChange={(event) => setField(name, event.currentTarget.value)}
          required
          value={values[name]}
        >
          <option value="">Select {label.toLowerCase()}</option>
          {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
        {error ? <span className="text-xs text-destructive" role="alert">{error}</span> : null}
      </label>
    )
  }

  function updateHours(index: number, changes: Partial<OpeningHour>) {
    setTouched((current) => ({ ...current, openingHours: true }))
    setValues((current) => ({
      ...current,
      openingHours: current.openingHours.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item,
      ),
    }))
  }

  async function chooseLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    setLogoError(undefined)
    if (!file) {
      setValues((current) => ({ ...current, logo: null }))
      setLogoName(initialValues.hasLogo ? "Existing logo saved" : "")
      return
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setLogoError("Choose a JPEG, PNG, or WebP image.")
      return
    }
    if (file.size > 1_048_576) {
      setLogoError("Logo must be smaller than 1 MB.")
      return
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    }).catch(() => "")
    if (!dataUrl) {
      setLogoError("We couldn't read this image. Choose another file.")
      return
    }
    setLogoName(file.name)
    setValues((current) => ({ ...current, logo: { dataUrl, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" } }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !validation.success || logoError) return
    setPending(true)
    const response = await postJson<BusinessOnboardingData>("/api/businesses/onboarding", values)
    if (!response.ok) {
      setPending(false)
      toast.error(response.error.message)
      return
    }
    if (response.message) toast.success(response.message)
    window.location.replace(response.data.redirectTo)
  }

  const hoursError = fieldError("openingHours")

  return (
    <form className="grid gap-8" noValidate onSubmit={handleSubmit}>
      <section className="grid gap-5">
        <div><h2 className="font-semibold">Business information</h2><p className="mt-1 text-sm text-muted-foreground">These details set up your workspace and reporting defaults.</p></div>
        <div className="grid gap-5 md:grid-cols-2">
          {renderInput("name", "Business name", { autoComplete: "organization", maxLength: 120, placeholder: "Aster & Co." })}
          {renderSelect("categoryCode", "Business category", businessCategories)}
          {renderInput("phone", "Phone number", { autoComplete: "tel", maxLength: 24, placeholder: "+234 801 234 5678", type: "tel" })}
          {renderSelect("countryCode", "Country", countries)}
          {renderSelect("currencyCode", "Currency", currencies)}
          <label className="grid gap-2">
            <FieldLabel optional>Logo</FieldLabel>
            <span className={cn("flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 text-sm text-muted-foreground hover:bg-muted/50", logoError && "border-destructive")}>
              <ImagePlus aria-hidden="true" className="size-4" />
              <span className="truncate">{logoName || "Choose an image"}</span>
              <input accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={chooseLogo} type="file" />
            </span>
            <span className={cn("text-xs", logoError ? "text-destructive" : "text-muted-foreground")}>{logoError || "JPEG, PNG, or WebP. Maximum 1 MB."}</span>
          </label>
        </div>
      </section>

      <section className="grid gap-5 border-t pt-8">
        <div><h2 className="font-semibold">Business details</h2><p className="mt-1 text-sm text-muted-foreground">Optional public and contact information. You can update it later.</p></div>
        <label className="grid gap-2"><FieldLabel optional>Business description</FieldLabel><Textarea maxLength={1000} onChange={(event) => setField("description", event.currentTarget.value)} placeholder="Tell customers what your business does." value={values.description} /></label>
        <div className="grid gap-5 md:grid-cols-2">
          {renderInput("email", "Business email", { autoComplete: "email", maxLength: 254, optional: true, placeholder: "hello@business.com", type: "email" })}
          {renderInput("websiteUrl", "Website", { autoComplete: "url", maxLength: 2048, optional: true, placeholder: "https://business.com", type: "url" })}
          {renderInput("whatsappPhone", "WhatsApp number", { autoComplete: "tel", maxLength: 24, optional: true, placeholder: "+234 801 234 5678", type: "tel" })}
          {renderInput("instagramAccount", "Instagram account", { maxLength: 255, optional: true, placeholder: "@yourbusiness" })}
          {renderInput("facebookPage", "Facebook page", { maxLength: 255, optional: true, placeholder: "facebook.com/yourbusiness" })}
          {renderInput("address", "Address", { autoComplete: "street-address", maxLength: 500, optional: true, placeholder: "Business address" })}
        </div>
      </section>

      <section className="grid gap-5 border-t pt-8">
        <div><h2 className="font-semibold">Opening hours <span className="font-normal text-muted-foreground">(optional)</span></h2><p className="mt-1 text-sm text-muted-foreground">Turn off days when your business is closed.</p></div>
        <div className="overflow-hidden rounded-xl border">
          {values.openingHours.map((hours, index) => (
            <div className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[160px_1fr]" key={hours.day}>
              <label className="flex items-center gap-3 text-sm font-medium"><input checked={hours.enabled} className="size-4 accent-primary" onChange={(event) => updateHours(index, { enabled: event.currentTarget.checked })} type="checkbox" />{weekDays[index][1]}</label>
              {hours.enabled ? <div className="col-span-2 flex items-center gap-2 sm:col-span-1"><Input aria-label={`${weekDays[index][1]} opening time`} className="h-9" onChange={(event) => updateHours(index, { open: event.currentTarget.value })} type="time" value={hours.open} /><span className="text-sm text-muted-foreground">to</span><Input aria-label={`${weekDays[index][1]} closing time`} className="h-9" onChange={(event) => updateHours(index, { close: event.currentTarget.value })} type="time" value={hours.close} /></div> : <span className="text-sm text-muted-foreground">Closed</span>}
            </div>
          ))}
        </div>
        {hoursError ? <p className="text-xs text-destructive" role="alert">Check that every closing time is later than its opening time.</p> : null}
      </section>

      <div className="flex justify-end border-t pt-6">
        <Button className="min-w-44" disabled={!validation.success || Boolean(logoError) || pending} size="lg" type="submit">
          {pending ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Creating business…</> : "Create business"}
        </Button>
      </div>
    </form>
  )
}
