"use client"

import { Download, LoaderCircle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import type { DashboardExportData } from "@/features/dashboard/api-types"
import { postJson } from "@/lib/api/client"

type DashboardExportButtonProps = {
  endDate: string
  startDate: string
}

export function DashboardExportButton({
  endDate,
  startDate,
}: DashboardExportButtonProps) {
  const [pending, setPending] = useState(false)

  async function handleExport() {
    if (pending) return

    setPending(true)
    const response = await postJson<DashboardExportData>(
      "/api/dashboard/export",
      { endDate, startDate },
    )
    setPending(false)

    if (!response.ok) {
      toast.error(response.error.message)
      return
    }

    const fileUrl = URL.createObjectURL(
      new Blob([response.data.content], { type: response.data.mimeType }),
    )
    const downloadLink = document.createElement("a")
    downloadLink.href = fileUrl
    downloadLink.download = response.data.fileName
    document.body.append(downloadLink)
    downloadLink.click()
    downloadLink.remove()
    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 0)

    if (response.message) toast.success(response.message)
  }

  return (
    <Button
      className="w-fit"
      disabled={pending}
      onClick={() => void handleExport()}
      size="lg"
      type="button"
      variant="outline"
    >
      {pending ? (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      ) : (
        <Download aria-hidden="true" />
      )}
      {pending ? "Preparing export…" : "Export overview"}
    </Button>
  )
}
