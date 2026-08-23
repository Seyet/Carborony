"use client"

import { useState } from "react"
import { Download, LoaderCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { downloadTransactionDocument } from "../documents/download-transaction-document"
import type { TransactionDocumentKind } from "../documents/types"

type TransactionDocumentButtonProps = {
  documentNumber: string
  id: string
  kind: TransactionDocumentKind
}

export function TransactionDocumentButton({
  documentNumber,
  id,
  kind,
}: TransactionDocumentButtonProps) {
  const [pending, setPending] = useState(false)

  async function download() {
    if (pending) return
    setPending(true)
    const result = await downloadTransactionDocument(kind, id, documentNumber)
    setPending(false)

    if (!result.ok) {
      toast.error(result.message)
      return
    }

    toast.success(`${kind === "invoice" ? "Invoice" : "Receipt"} downloaded successfully.`)
  }

  return (
    <Button
      aria-label={`Download ${kind === "invoice" ? "invoice" : "receipt"} ${documentNumber}`}
      disabled={pending}
      onClick={download}
      size="sm"
      type="button"
      variant="outline"
    >
      {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Download aria-hidden="true" />}
      PDF
    </Button>
  )
}
