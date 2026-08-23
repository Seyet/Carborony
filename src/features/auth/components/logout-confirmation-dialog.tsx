"use client"

import { LoaderCircle, LogOut } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AuthRedirectData } from "@/features/auth/api-types"
import { postJson } from "@/lib/api/client"

type LogoutConfirmationDialogProps = {
  businessName: string
  onOpenChange: (open: boolean) => void
  open: boolean
}

export function LogoutConfirmationDialog({
  businessName,
  onOpenChange,
  open,
}: LogoutConfirmationDialogProps) {
  const [pending, setPending] = useState(false)

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return
    onOpenChange(nextOpen)
  }

  async function handleLogout() {
    if (pending) return

    setPending(true)
    const response = await postJson<AuthRedirectData>("/api/auth/logout", {
      intent: "logout",
    })

    if (!response.ok) {
      setPending(false)
      toast.error(response.error.message)
      return
    }

    window.location.replace(response.data.redirectTo)
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader className="pr-8">
          <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <LogOut className="size-5" aria-hidden="true" />
          </span>
          <DialogTitle>Sign out of Carborony?</DialogTitle>
          <DialogDescription>
            You’ll need to sign in again to access {businessName} on this
            device.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" disabled={pending} type="button" />
            }
          >
            Cancel
          </DialogClose>
          <Button
            disabled={pending}
            onClick={() => void handleLogout()}
            type="button"
            variant="destructive"
          >
            {pending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <LogOut aria-hidden="true" />
            )}
            {pending ? "Signing out…" : "Sign out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
