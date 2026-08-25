"use client"

import { useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
  Ban,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MailPlus,
  MoreHorizontal,
  RotateCw,
  ShieldCheck,
  UserRoundCog,
  Users,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { postJson } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import type { StaffMutationData } from "./api-types"
import { inviteStaffSchema } from "./schemas"
import {
  permissionLabels,
  type StaffMemberStatus,
  type StaffPageData,
  type StaffRecord,
  type StaffRoleCode,
  type StaffRoleOption,
} from "./types"

type InviteDraft = {
  email: string
  fullName: string
  phone: string
  roleCode: StaffRoleCode
}

const emptyInvite: InviteDraft = {
  email: "",
  fullName: "",
  phone: "",
  roleCode: "sales",
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    expired: "bg-muted text-muted-foreground",
    pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    suspended: "bg-destructive/10 text-destructive",
  }
  return (
    <Badge className={styles[status] ?? ""} variant="secondary">
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users
  label: string
  value: number
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <span>
          <span className="block text-xs text-muted-foreground">{label}</span>
          <span className="block text-xl font-semibold tabular-nums">{value}</span>
        </span>
      </CardContent>
    </Card>
  )
}

function RolePermissionsPreview({ role }: { role: StaffRoleOption | undefined }) {
  if (!role) return null

  const permissions = role.permissions
    .map((permission) => permissionLabels[permission] ?? permission)
    .sort((left, right) => left.localeCompare(right))

  return (
    <section
      aria-live="polite"
      className="rounded-xl border bg-muted/25 p-3.5 sm:col-span-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-primary" />
            <h3 className="text-sm font-semibold">{role.name} permissions</h3>
          </div>
          {role.description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {role.description}
            </p>
          ) : null}
        </div>
        <Badge className="shrink-0" variant="secondary">
          {permissions.length} {permissions.length === 1 ? "permission" : "permissions"}
        </Badge>
      </div>
      {permissions.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`${role.name} permissions`}>
          {permissions.map((permission) => (
            <li
              className="rounded-md border bg-background px-2 py-1 text-xs text-foreground"
              key={permission}
            >
              {permission}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          This role does not currently grant workspace access.
        </p>
      )}
    </section>
  )
}

function InviteStaffDialog({ data }: { data: StaffPageData }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [draft, setDraft] = useState<InviteDraft>(emptyInvite)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const selectedRole = data.roles.find((role) => role.code === draft.roleCode)

  function close() {
    if (pending) return
    setOpen(false)
    setDraft(emptyInvite)
    setErrors({})
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const validation = inviteStaffSchema.safeParse({
      action: "invite",
      ...draft,
    })
    if (!validation.success) {
      const nextErrors: Record<string, string> = {}
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0]
        if (typeof field === "string" && !nextErrors[field]) {
          nextErrors[field] = issue.message
        }
      })
      setErrors(nextErrors)
      return
    }

    setPending(true)
    const response = await postJson<StaffMutationData>("/api/staff", validation.data)
    setPending(false)
    if (!response.ok) {
      setErrors(Object.fromEntries(
        Object.entries(response.error.fields ?? {}).map(([field, messages]) => [field, messages[0] ?? "Check this field."]),
      ))
      toast.error(response.error.message)
      return
    }
    toast.success(response.message ?? "Staff invitation sent.")
    close()
    router.refresh()
  }

  return (
    <Dialog onOpenChange={(nextOpen) => nextOpen ? setOpen(true) : close()} open={open}>
      <DialogTrigger render={<Button size="sm" />}>
        <MailPlus aria-hidden="true" />
        Invite employee
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <form noValidate onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Invite an employee</DialogTitle>
            <DialogDescription>
              They will receive a secure email invitation to join {data.businessName}. The invitation remains open for seven days.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-5 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
              Name
              <Input
                aria-invalid={Boolean(errors.fullName) || undefined}
                autoComplete="name"
                disabled={pending}
                maxLength={100}
                onChange={(event) => setDraft((value) => ({ ...value, fullName: event.target.value }))}
                placeholder="Employee full name"
                value={draft.fullName}
              />
              {errors.fullName ? <span className="text-xs text-destructive">{errors.fullName}</span> : null}
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Email
              <Input
                aria-invalid={Boolean(errors.email) || undefined}
                autoComplete="email"
                disabled={pending}
                maxLength={254}
                onChange={(event) => setDraft((value) => ({ ...value, email: event.target.value }))}
                placeholder="employee@example.com"
                type="email"
                value={draft.email}
              />
              {errors.email ? <span className="text-xs text-destructive">{errors.email}</span> : null}
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Phone <span className="font-normal text-muted-foreground">(optional)</span>
              <Input
                aria-invalid={Boolean(errors.phone) || undefined}
                autoComplete="tel"
                disabled={pending}
                maxLength={32}
                onChange={(event) => setDraft((value) => ({ ...value, phone: event.target.value }))}
                placeholder="+234 800 000 0000"
                type="tel"
                value={draft.phone}
              />
              {errors.phone ? <span className="text-xs text-destructive">{errors.phone}</span> : null}
            </label>
            <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
              Role
              <select
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                disabled={pending}
                onChange={(event) => setDraft((value) => ({ ...value, roleCode: event.target.value as StaffRoleCode }))}
                value={draft.roleCode}
              >
                {data.roles.map((role) => (
                  <option key={role.code} value={role.code}>{role.name}</option>
                ))}
              </select>
            </label>
            <RolePermissionsPreview role={selectedRole} />
          </div>
          <DialogFooter>
            <Button disabled={pending} onClick={close} type="button" variant="outline">Cancel</Button>
            <Button disabled={pending} type="submit">
              {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <MailPlus aria-hidden="true" />}
              {pending ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function StaffActions({ data, record }: { data: StaffPageData; record: StaffRecord }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [roleCode, setRoleCode] = useState(record.roleCode as StaffRoleCode)
  const [status, setStatus] = useState<StaffMemberStatus>(record.status === "suspended" ? "suspended" : "active")
  const selectedRole = data.roles.find((role) => role.code === roleCode)

  async function mutate(body: Record<string, unknown>, success: string) {
    if (pending) return
    setPending(true)
    const response = await postJson<StaffMutationData>("/api/staff", body)
    setPending(false)
    if (!response.ok) {
      toast.error(response.error.message)
      return
    }
    toast.success(response.message ?? success)
    setEditOpen(false)
    router.refresh()
  }

  if (
    record.roleCode === "owner"
    || record.isCurrentUser
    || (record.roleCode === "admin" && !data.canInviteAdmin)
  ) return null

  if (record.kind === "invitation") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button aria-label={`Manage invitation for ${record.fullName}`} size="icon-sm" variant="ghost" />}>
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={pending}
            nativeButton
            onClick={() => mutate({ action: "resend", invitationId: record.id }, "Invitation resent.")}
          >
            <RotateCw aria-hidden="true" />Resend invitation
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={pending}
            nativeButton
            onClick={() => mutate({ action: "revoke", invitationId: record.id }, "Invitation revoked.")}
            variant="destructive"
          >
            <XCircle aria-hidden="true" />Revoke invitation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <Dialog onOpenChange={(open) => !pending && setEditOpen(open)} open={editOpen}>
      <DialogTrigger render={<Button aria-label={`Manage ${record.fullName}`} size="icon-sm" variant="ghost" />}>
        <MoreHorizontal aria-hidden="true" />
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage {record.fullName}</DialogTitle>
          <DialogDescription>Update this employee&apos;s role or workspace access.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <label className="grid gap-1.5 text-sm font-medium">
            Role
            <select
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
              disabled={pending}
              onChange={(event) => setRoleCode(event.target.value as StaffRoleCode)}
              value={roleCode}
            >
              {data.roles.map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}
            </select>
          </label>
          <RolePermissionsPreview role={selectedRole} />
          <label className="grid gap-1.5 text-sm font-medium">
            Status
            <select
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
              disabled={pending}
              onChange={(event) => setStatus(event.target.value as StaffMemberStatus)}
              value={status}
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
          {status === "suspended" ? (
            <p className="rounded-lg bg-destructive/8 p-3 text-xs leading-5 text-destructive">
              Suspension immediately blocks this employee from the business while keeping their history.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button disabled={pending} onClick={() => setEditOpen(false)} type="button" variant="outline">Cancel</Button>
          <Button
            disabled={pending}
            onClick={() => mutate({ action: "update", memberId: record.id, roleCode, status }, "Staff member updated.")}
            type="button"
          >
            {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <ShieldCheck aria-hidden="true" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function StaffManagement({ data }: { data: StaffPageData }) {
  const counts = useMemo(() => ({
    active: data.records.filter((record) => record.status === "active").length,
    pending: data.records.filter((record) => record.status === "pending").length,
    suspended: data.records.filter((record) => record.status === "suspended").length,
    total: data.records.filter((record) => record.kind === "member").length,
  }), [data.records])

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Team administration</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Staff</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Invite employees, assign operational roles, and control access to {data.businessName}.
          </p>
        </div>
        <InviteStaffDialog data={data} />
      </header>

      <section aria-label="Staff summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard icon={Users} label="Team members" value={counts.total} />
        <SummaryCard icon={CheckCircle2} label="Active" value={counts.active} />
        <SummaryCard icon={Clock3} label="Pending invites" value={counts.pending} />
        <SummaryCard icon={Ban} label="Suspended" value={counts.suspended} />
      </section>

      <Card size="sm">
        <CardHeader className="border-b">
          <CardTitle as="h2">Employees and invitations</CardTitle>
          <CardDescription>Invitations remain open for seven days. Resend one if its secure email link expires.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 sm:pl-6">Employee</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Phone</TableHead>
                <TableHead className="hidden md:table-cell">{data.records.some((record) => record.kind === "invitation") ? "Invited / joined" : "Joined"}</TableHead>
                <TableHead className="w-12 pr-4 sm:pr-6"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.records.map((record) => (
                <TableRow key={`${record.kind}-${record.id}`}>
                  <TableCell className="pl-4 sm:pl-6">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        record.status === "suspended" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
                      )}>
                        {record.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{record.fullName}{record.isCurrentUser ? " (you)" : ""}</span>
                        <span className="block truncate text-xs text-muted-foreground">{record.email ?? "Email unavailable"}</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{record.roleName}</Badge></TableCell>
                  <TableCell><StatusBadge status={record.status} /></TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{record.phone ?? "—"}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {record.kind === "invitation"
                      ? record.status === "expired" ? `Expired ${formatDate(record.expiresAt)}` : `Invited ${formatDate(record.invitedAt)}`
                      : formatDate(record.joinedAt)}
                  </TableCell>
                  <TableCell className="pr-4 text-right sm:pr-6"><StaffActions data={data} record={record} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!data.records.length ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <UserRoundCog aria-hidden="true" className="size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No staff records yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Invite your first employee to get started.</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
