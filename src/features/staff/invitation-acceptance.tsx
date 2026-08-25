"use client"

import { type FormEvent, useMemo, useState } from "react"
import { ArrowRight, Building2, Check, LoaderCircle, LogOut, Mail, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FormField } from "@/features/auth/components/form-field"
import { SubmitButton } from "@/features/auth/components/submit-button"
import { postJson } from "@/lib/api/client"
import type { AcceptStaffInvitationData } from "./api-types"
import { acceptStaffInvitationSchema } from "./schemas"
import type { MyStaffInvitation } from "./types"
import { permissionLabels } from "./types"

type Draft = {
  confirmPassword: string
  fullName: string
  password: string
  phone: string
}

export function InvitationSignOutButton() {
  const [pending, setPending] = useState(false)

  async function signOut() {
    if (pending) return
    setPending(true)
    const response = await postJson<{ redirectTo: string }>("/api/auth/logout", {
      intent: "logout",
    })

    if (!response.ok) {
      setPending(false)
      toast.error(response.error.message)
      return
    }

    const next = `${window.location.pathname}${window.location.search}`
    window.location.replace(`/login?next=${encodeURIComponent(next)}`)
  }

  return (
    <Button
      className="mt-3"
      disabled={pending}
      onClick={signOut}
      size="sm"
      type="button"
      variant="ghost"
    >
      {pending
        ? <LoaderCircle aria-hidden="true" className="animate-spin" />
        : <LogOut aria-hidden="true" />}
      {pending ? "Signing out…" : "Use another account"}
    </Button>
  )
}

export function InvitationAcceptance({
  invitation,
}: {
  invitation: MyStaffInvitation
}) {
  const [draft, setDraft] = useState<Draft>({
    confirmPassword: "",
    fullName: invitation.fullName,
    password: "",
    phone: invitation.phone ?? "",
  })
  const [pending, setPending] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const request = useMemo(() => ({
    confirmPassword: invitation.requiresPassword
      ? draft.confirmPassword
      : undefined,
    fullName: draft.fullName,
    invitationId: invitation.id,
    password: invitation.requiresPassword ? draft.password : undefined,
    phone: draft.phone,
  }), [draft, invitation.id, invitation.requiresPassword])
  const validation = useMemo(
    () => acceptStaffInvitationSchema.safeParse(request),
    [request],
  )

  function fieldProps(name: keyof Draft) {
    const message = validation.success
      ? undefined
      : validation.error.issues.find((issue) => issue.path[0] === name)?.message
    const errorMessage = touched[name] ? message : undefined

    return {
      errorMessage,
      invalid: Boolean(errorMessage),
      onBlur: () => setTouched((current) => ({ ...current, [name]: true })),
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.currentTarget.value
        setTouched((current) => ({ ...current, [name]: true }))
        setDraft((current) => ({ ...current, [name]: value }))
      },
      value: draft[name],
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    if (!validation.success) {
      const invalid = Object.fromEntries(
        validation.error.issues
          .map((issue) => issue.path[0])
          .filter((field): field is string => typeof field === "string")
          .map((field) => [field, true]),
      )
      setTouched((current) => ({ ...current, ...invalid }))
      return
    }

    setPending(true)
    const response = await postJson<AcceptStaffInvitationData>(
      "/api/staff/invitations/accept",
      validation.data,
    )

    if (!response.ok) {
      setPending(false)
      toast.error(response.error.message)
      return
    }

    toast.success(response.message ?? `You joined ${invitation.businessName}.`)
    window.location.assign(response.data.redirectTo)
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="rounded-2xl border bg-card shadow-xl shadow-foreground/5">
        <header className="border-b px-6 py-6 sm:px-8">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <Badge variant="secondary">Staff invitation</Badge>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                Join {invitation.businessName}
              </h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                You have been invited as {invitation.roleName}. Confirm your details to activate your workspace access.
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[1fr_0.9fr]">
          <form className="space-y-5" noValidate onSubmit={submit}>
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
              <Mail aria-hidden="true" className="size-4 text-muted-foreground" />
              <span className="truncate">{invitation.email}</span>
            </div>
            <FormField
              {...fieldProps("fullName")}
              autoComplete="name"
              label="Full name"
              maxLength={100}
              name="fullName"
              placeholder="Your full name"
            />
            <FormField
              {...fieldProps("phone")}
              autoComplete="tel"
              label="Phone number"
              maxLength={32}
              name="phone"
              placeholder="+234 800 000 0000"
              required={false}
              type="tel"
            />
            {invitation.requiresPassword ? (
              <>
                <FormField
                  {...fieldProps("password")}
                  autoComplete="new-password"
                  hint="Use 8–72 characters with uppercase, lowercase, and a number."
                  label="Create password"
                  maxLength={72}
                  minLength={8}
                  name="password"
                  placeholder="Create a strong password"
                  type="password"
                />
                <FormField
                  {...fieldProps("confirmPassword")}
                  autoComplete="new-password"
                  label="Confirm password"
                  maxLength={72}
                  name="confirmPassword"
                  placeholder="Enter your password again"
                  type="password"
                />
              </>
            ) : (
              <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
                Your existing Carborony password stays unchanged. This invitation only adds access to this business.
              </p>
            )}
            <SubmitButton disabled={!validation.success} pending={pending}>
              Accept invitation
              <ArrowRight aria-hidden="true" />
            </SubmitButton>
          </form>

          <aside className="rounded-xl border bg-muted/25 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">{invitation.roleName} access</h2>
            </div>
            <ul className="mt-3 grid gap-2">
              {invitation.permissions.map((permission) => (
                <li className="flex gap-2 text-xs leading-5 text-muted-foreground" key={permission}>
                  <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  {permissionLabels[permission] ?? permission}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Invitations are bound to the verified email address that received them.
      </p>
    </div>
  )
}
