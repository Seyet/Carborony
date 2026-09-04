"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Camera as InstagramIcon,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Unplug,
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
import { postJson } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import type { InstagramConnection } from "./types"

type ConnectionAction = "connect" | "disconnect" | "sync" | null

function formatDate(value: string | null) {
  if (!value) return "Not yet"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not yet"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function connectionMessage(status: InstagramConnection["status"]) {
  if (status === "expired") return "The access token has expired. Reconnect to resume imports."
  if (status === "needs_reauthorization") return "Instagram needs your approval again before Carborony can sync."
  if (status === "error") return "We could not verify this connection. Try reconnecting the account."
  return null
}

export function InstagramConnectionCard({
  canManage,
  connection,
  isPreview = false,
}: {
  canManage: boolean
  connection: InstagramConnection
  isPreview?: boolean
}) {
  const router = useRouter()
  const [pendingAction, setPendingAction] = useState<ConnectionAction>(null)
  const connected = connection.status === "connected"
  const requiresAttention = connection.status === "expired"
    || connection.status === "needs_reauthorization"
    || connection.status === "error"
  const warning = connectionMessage(connection.status)

  async function connect() {
    if (pendingAction) return
    setPendingAction("connect")
    const response = await postJson<{ redirectTo: string }>(
      "/api/integrations/instagram/connect",
      {},
    )
    if (!response.ok) {
      setPendingAction(null)
      toast.error(response.error.message)
      return
    }
    window.location.assign(response.data.redirectTo)
  }

  async function sync() {
    if (pendingAction) return
    setPendingAction("sync")
    const response = await postJson<Record<string, never>>(
      "/api/integrations/instagram/sync",
      {},
    )
    setPendingAction(null)
    if (!response.ok) {
      toast.error(response.error.message)
      return
    }
    toast.success(response.message ?? "Instagram sync started.")
    router.refresh()
  }

  async function disconnect() {
    if (pendingAction) return
    if (!window.confirm("Disconnect Instagram? Existing catalogue products will not be removed.")) return
    setPendingAction("disconnect")
    const response = await postJson<Record<string, never>>(
      "/api/integrations/instagram/disconnect",
      {},
    )
    setPendingAction(null)
    if (!response.ok) {
      toast.error(response.error.message)
      return
    }
    toast.success(response.message ?? "Instagram disconnected.")
    router.refresh()
  }

  return (
    <Card className="relative overflow-hidden border-0 bg-card shadow-sm ring-1 ring-foreground/10">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.14),transparent_68%)]"
      />
      <CardHeader className="relative border-b">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#7c3aed,#db2777_55%,#f59e0b)] text-white shadow-sm">
              <InstagramIcon aria-hidden="true" className="size-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle as="h2">Instagram</CardTitle>
                {isPreview ? <Badge variant="outline">Preview data</Badge> : null}
                <Badge
                  className={cn(
                    connected && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                    requiresAttention && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                  )}
                  variant="secondary"
                >
                  {connected ? "Connected" : requiresAttention ? "Action required" : "Not connected"}
                </Badge>
              </div>
              <CardDescription className="mt-1 max-w-2xl">
                Import your professional Instagram posts as editable catalogue drafts. Nothing is published without your approval.
              </CardDescription>
            </div>
          </div>

          {connected ? (
            <div className="flex flex-wrap gap-2">
              <Button disabled={!canManage || Boolean(pendingAction)} onClick={sync} variant="outline">
                {pendingAction === "sync" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}
                Sync now
              </Button>
              <Button disabled={!canManage || Boolean(pendingAction)} onClick={disconnect} variant="ghost">
                {pendingAction === "disconnect" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Unplug aria-hidden="true" />}
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button disabled={!canManage || Boolean(pendingAction)} onClick={connect}>
                {pendingAction === "connect" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <InstagramIcon aria-hidden="true" />}
                {requiresAttention ? "Reconnect Instagram" : "Connect Instagram"}
                {!pendingAction ? <ExternalLink aria-hidden="true" /> : null}
              </Button>
              {requiresAttention ? (
                <Button disabled={!canManage || Boolean(pendingAction)} onClick={disconnect} variant="ghost">
                  {pendingAction === "disconnect" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Unplug aria-hidden="true" />}
                  Disconnect
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative">
        {connected ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Connected account</p>
              <p className="mt-1 font-medium">@{connection.username}</p>
              <p className="mt-0.5 text-xs capitalize text-muted-foreground">{connection.accountType} account</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last synchronized</p>
              <p className="mt-1 font-medium">{formatDate(connection.lastSyncedAt)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Recent posts checked on demand</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Import protection</p>
              <p className="mt-1 flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                <ShieldCheck aria-hidden="true" className="size-4" />
                Approval required
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Products stay in review until you approve them</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-dashed bg-muted/20 p-4">
            {requiresAttention
              ? <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-600" />
              : <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />}
            <div>
              <p className="font-medium">{requiresAttention ? "Reconnect to continue" : "Ready when your business is"}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {warning ?? "Connect an Instagram Business or Creator account. Carborony only reads eligible media you authorize."}
              </p>
            </div>
          </div>
        )}
        {!canManage ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Only the business owner can connect, reconnect, or disconnect Instagram.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
