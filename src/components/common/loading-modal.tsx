"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AppLogo } from "./app-logo"

type LoadingModalProps = {
  description?: string
  open: boolean
  title?: string
}

function LoadingModal({
  description = "This may take a moment.",
  open,
  title = "Please wait",
}: LoadingModalProps) {
  return (
    <Dialog open={open}>
      <DialogContent className="loading-modal overflow-hidden shadow-2xl sm:max-w-md" showCloseButton={false}>
        <div
          aria-live="polite"
          className="flex flex-col items-center gap-4 px-2 py-4 text-center"
          role="status"
        >
          <span className="relative flex size-20 shrink-0 items-center justify-center rounded-full bg-primary/5" data-loading-logo>
            <span
              aria-hidden="true"
              className="absolute inset-0 animate-spin rounded-full border-2 border-primary/15 border-t-primary"
            />
            <AppLogo className="size-14 rounded-full" />
          </span>

          <DialogHeader className="min-w-0 items-center">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { LoadingModal, type LoadingModalProps }
