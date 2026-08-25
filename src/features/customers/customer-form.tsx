"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Save } from "lucide-react"
import { toast } from "sonner"

import { Button, ButtonLink } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { postJson } from "@/lib/api/client"
import { saveCustomerSchema } from "./schemas"
import { customerSegmentLabels } from "./customer-segment"
import { customerSegments, type CustomerProfile, type SaveCustomerData } from "./types"

type CustomerDraft = {
  address: string
  birthday: string
  email: string
  fullName: string
  notes: string
  phone: string
  segment: CustomerProfile["segment"]
  tags: string
}

const emptyDraft: CustomerDraft = {
  address: "",
  birthday: "",
  email: "",
  fullName: "",
  notes: "",
  phone: "",
  segment: "new",
  tags: "",
}

function initialDraft(customer?: CustomerProfile): CustomerDraft {
  if (!customer) return emptyDraft
  return {
    address: customer.address ?? "",
    birthday: customer.birthday ?? "",
    email: customer.email ?? "",
    fullName: customer.name,
    notes: customer.notes ?? "",
    phone: customer.phone ?? "",
    segment: customer.segment,
    tags: customer.tags.join(", "),
  }
}

export function CustomerForm({ customer }: { customer?: CustomerProfile }) {
  const router = useRouter()
  const [draft, setDraft] = useState(() => initialDraft(customer))
  const [touched, setTouched] = useState<Set<keyof CustomerDraft>>(new Set())
  const [pending, setPending] = useState(false)
  const payload = useMemo(() => ({
    address: draft.address,
    birthday: draft.birthday,
    email: draft.email,
    fullName: draft.fullName,
    notes: draft.notes,
    phone: draft.phone,
    segment: draft.segment,
    tags: [...new Set(draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean))],
  }), [draft])
  const validation = saveCustomerSchema.safeParse(payload)
  const errors = validation.success ? {} : validation.error.flatten().fieldErrors

  function update(field: keyof CustomerDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
    setTouched((current) => new Set(current).add(field))
  }

  function errorFor(field: keyof CustomerDraft) {
    if (!touched.has(field)) return null
    return errors[field]?.[0] ?? null
  }

  async function submit() {
    if (pending || !validation.success) return
    setPending(true)
    const response = await postJson<SaveCustomerData>(
      customer ? `/api/customers/${customer.id}` : "/api/customers",
      validation.data,
    )
    setPending(false)
    if (!response.ok) {
      toast.error(response.error.message)
      return
    }
    toast.success(response.message ?? "Customer saved successfully.")
    router.push(`/app/customers/${response.data.customerId}`)
    router.refresh()
  }

  const nameError = errorFor("fullName")
  const phoneError = errorFor("phone")
  const emailError = errorFor("email")
  const addressError = errorFor("address")
  const birthdayError = errorFor("birthday")
  const tagsError = errorFor("tags")
  const notesError = errorFor("notes")

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader><CardTitle as="h2">Customer information</CardTitle><p className="text-sm text-muted-foreground">Store contact details, delivery information, tags, and CRM segment.</p></CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium sm:col-span-2">Full name<Input aria-invalid={Boolean(nameError) || undefined} autoComplete="name" maxLength={120} onChange={(event) => update("fullName", event.currentTarget.value)} required value={draft.fullName} />{nameError ? <span className="text-xs text-destructive">{nameError}</span> : null}</label>
        <label className="grid gap-2 text-sm font-medium">Phone<Input aria-invalid={Boolean(phoneError) || undefined} autoComplete="tel" maxLength={32} onChange={(event) => update("phone", event.currentTarget.value)} type="tel" value={draft.phone} />{phoneError ? <span className="text-xs text-destructive">{phoneError}</span> : null}</label>
        <label className="grid gap-2 text-sm font-medium">Email<Input aria-invalid={Boolean(emailError) || undefined} autoComplete="email" maxLength={254} onChange={(event) => update("email", event.currentTarget.value)} type="email" value={draft.email} />{emailError ? <span className="text-xs text-destructive">{emailError}</span> : null}</label>
        <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">At least one phone number or email address is required.</p>
        <label className="grid gap-2 text-sm font-medium sm:col-span-2">Address <span className="font-normal text-muted-foreground">(optional)</span><Textarea aria-invalid={Boolean(addressError) || undefined} autoComplete="street-address" maxLength={500} onChange={(event) => update("address", event.currentTarget.value)} placeholder="Street, city, state, and landmark" value={draft.address} />{addressError ? <span className="text-xs text-destructive">{addressError}</span> : null}</label>
        <label className="grid gap-2 text-sm font-medium">Birthday <span className="font-normal text-muted-foreground">(optional)</span><Input aria-invalid={Boolean(birthdayError) || undefined} max="9999-12-31" min="1900-01-01" onChange={(event) => update("birthday", event.currentTarget.value)} type="date" value={draft.birthday} />{birthdayError ? <span className="text-xs text-destructive">{birthdayError}</span> : null}</label>
        <label className="grid gap-2 text-sm font-medium">Segment<select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" onChange={(event) => update("segment", event.currentTarget.value)} value={draft.segment}>{customerSegments.map((segment) => <option key={segment} value={segment}>{customerSegmentLabels[segment]}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-medium sm:col-span-2">Tags <span className="font-normal text-muted-foreground">(optional)</span><Input aria-invalid={Boolean(tagsError) || undefined} maxLength={820} onChange={(event) => update("tags", event.currentTarget.value)} placeholder="retail, wholesale, Lagos" value={draft.tags} /><span className={tagsError ? "text-xs text-destructive" : "text-xs font-normal text-muted-foreground"}>{tagsError ?? "Separate tags with commas. Up to 20 tags."}</span></label>
        <label className="grid gap-2 text-sm font-medium sm:col-span-2">Notes <span className="font-normal text-muted-foreground">(optional)</span><Textarea aria-invalid={Boolean(notesError) || undefined} maxLength={2000} onChange={(event) => update("notes", event.currentTarget.value)} placeholder="Preferences, context, or relationship notes" value={draft.notes} />{notesError ? <span className="text-xs text-destructive">{notesError}</span> : null}</label>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:col-span-2 sm:flex-row sm:justify-end"><ButtonLink href={customer ? `/app/customers/${customer.id}` : "/app/customers"} variant="outline">Cancel</ButtonLink><Button disabled={pending || !validation.success} onClick={submit} type="button">{pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}{pending ? "Saving…" : customer ? "Save changes" : "Create customer"}</Button></div>
      </CardContent>
    </Card>
  )
}
