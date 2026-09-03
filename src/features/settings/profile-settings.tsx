"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Laptop, LoaderCircle, Mail, Save, ShieldCheck, UserRound } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { postJson } from "@/lib/api/client"
import { profileSettingsSchema, securitySettingsSchema, type ProfileSettingsInput } from "./schemas"
import { SettingsImagePicker } from "./settings-image-picker"
import type { SettingsMutationData, SettingsPageData } from "./types"

function browserLabel(userAgent: string) {
  const browser = userAgent.includes("Edg/") ? "Microsoft Edge"
    : userAgent.includes("Chrome/") ? "Chrome"
      : userAgent.includes("Firefox/") ? "Firefox"
        : userAgent.includes("Safari/") ? "Safari"
          : "Current browser"
  const device = /Mobile|Android|iPhone|iPad/.test(userAgent) ? "mobile device" : "computer"
  return `${browser} on this ${device}`
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Current session"
}

export function ProfileSettings({ data }: { data: SettingsPageData }) {
  const router = useRouter()
  const [profile, setProfile] = useState({
    avatar: { action: "keep" } as ProfileSettingsInput["avatar"],
    fullName: data.profile.fullName,
    phone: data.profile.phone ?? "",
  })
  const [avatarUrl, setAvatarUrl] = useState(data.profile.avatarUrl)
  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pending, setPending] = useState<"password" | "profile" | "sessions" | null>(null)

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const validation = profileSettingsSchema.safeParse(profile)
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? "Check your profile details.")
      return
    }
    setPending("profile")
    const response = await postJson<SettingsMutationData>("/api/settings/profile", validation.data)
    setPending(null)
    if (!response.ok) return toast.error(response.error.message)
    if (response.data.avatarUrl !== undefined) setAvatarUrl(response.data.avatarUrl)
    setProfile((current) => ({ ...current, avatar: { action: "keep" } }))
    toast.success(response.message ?? "Profile updated.")
    router.refresh()
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const validation = securitySettingsSchema.safeParse({
      action: "change_password",
      confirmPassword,
      currentPassword,
      password,
    })
    if (!validation.success) return toast.error(validation.error.issues[0]?.message)
    setPending("password")
    const response = await postJson<SettingsMutationData>("/api/settings/security", validation.data)
    setPending(null)
    if (!response.ok) return toast.error(response.error.message)
    setCurrentPassword("")
    setPassword("")
    setConfirmPassword("")
    toast.success(response.message ?? "Password updated.")
  }

  async function signOutOthers() {
    if (pending || !window.confirm("Sign out every other session for this account?")) return
    setPending("sessions")
    const response = await postJson<SettingsMutationData>("/api/settings/security", { action: "sign_out_others" })
    setPending(null)
    if (!response.ok) return toast.error(response.error.message)
    toast.success(response.message ?? "Other sessions signed out.")
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="xl:col-span-2">
        <CardHeader><CardTitle as="h2">Personal profile</CardTitle><CardDescription>Your identity in Carborony and across your business workspaces.</CardDescription></CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={saveProfile}>
            <SettingsImagePicker disabled={Boolean(pending)} initialUrl={avatarUrl} label="Profile photo" onChange={(avatar, previewUrl) => { setProfile((current) => ({ ...current, avatar })); setAvatarUrl(previewUrl) }} round />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">Full name<Input autoComplete="name" disabled={Boolean(pending)} maxLength={100} onChange={(event) => setProfile({ ...profile, fullName: event.currentTarget.value })} value={profile.fullName} /></label>
              <label className="grid gap-1.5 text-sm font-medium">Phone number <span className="font-normal text-muted-foreground">(optional)</span><Input autoComplete="tel" disabled={Boolean(pending)} maxLength={32} onChange={(event) => setProfile({ ...profile, phone: event.currentTarget.value })} type="tel" value={profile.phone ?? ""} /></label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-xs text-muted-foreground">Current role: <strong className="font-medium text-foreground">{data.profile.roleName}</strong></p><Button disabled={Boolean(pending)} type="submit">{pending === "profile" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}Save profile</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle as="h2" className="flex items-center gap-2"><Mail aria-hidden="true" className="size-4" />Account email</CardTitle><CardDescription>Your verified address for signing in and account notifications.</CardDescription></CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex items-center gap-3 rounded-xl border bg-muted/20 px-4 py-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Mail aria-hidden="true" className="size-4" /></span><div className="min-w-0"><p className="text-xs text-muted-foreground">Signed-in email</p><p className="truncate text-sm font-medium">{data.profile.email}</p></div></div>
          <p className="text-xs text-muted-foreground">For account security, email changes are not available in settings.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle as="h2" className="flex items-center gap-2"><KeyRound aria-hidden="true" className="size-4" />Password</CardTitle><CardDescription>Use at least eight characters with uppercase, lowercase, and a number.</CardDescription></CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={changePassword}>
            <label className="grid gap-1.5 text-sm font-medium">Current password<Input autoComplete="current-password" disabled={Boolean(pending)} maxLength={72} onChange={(event) => setCurrentPassword(event.currentTarget.value)} type="password" value={currentPassword} /></label>
            <label className="grid gap-1.5 text-sm font-medium">New password<Input autoComplete="new-password" disabled={Boolean(pending)} maxLength={72} onChange={(event) => setPassword(event.currentTarget.value)} type="password" value={password} /></label>
            <label className="grid gap-1.5 text-sm font-medium">Confirm new password<Input autoComplete="new-password" disabled={Boolean(pending)} maxLength={72} onChange={(event) => setConfirmPassword(event.currentTarget.value)} type="password" value={confirmPassword} /></label>
            <div className="grid gap-2"><Button className="justify-self-start" disabled={Boolean(pending) || !currentPassword || !password || !confirmPassword} type="submit">{pending === "password" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <ShieldCheck aria-hidden="true" />}Update password</Button><p className="text-xs text-muted-foreground">If you do not know your current password, sign out and use Forgot password.</p></div>
          </form>
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader><CardTitle as="h2" className="flex items-center gap-2"><Laptop aria-hidden="true" className="size-4" />Session security</CardTitle><CardDescription>Review this session and revoke refresh access for every other signed-in device.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><UserRound aria-hidden="true" className="size-5" /></span><div><div className="flex items-center gap-2"><strong className="text-sm">{browserLabel(data.session.userAgent)}</strong><Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" variant="secondary">Current</Badge></div><p className="mt-1 text-xs text-muted-foreground">Last signed in {formatDate(data.session.lastSignedInAt)}</p></div></div>
          <Button disabled={Boolean(pending)} onClick={signOutOthers} type="button" variant="outline">{pending === "sessions" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <ShieldCheck aria-hidden="true" />}Sign out other sessions</Button>
        </CardContent>
      </Card>
    </div>
  )
}
