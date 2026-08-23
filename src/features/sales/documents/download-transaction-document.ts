"use client"

import type { TransactionDocumentKind } from "./types"

type DownloadResult =
  | { ok: true }
  | { message: string; ok: false }

function getErrorMessage(value: unknown) {
  if (
    typeof value === "object" && value !== null
    && "error" in value && typeof value.error === "object" && value.error !== null
    && "message" in value.error && typeof value.error.message === "string"
  ) {
    return value.error.message
  }

  return null
}

export async function downloadTransactionDocument(
  kind: TransactionDocumentKind,
  id: string,
  fallbackNumber: string,
): Promise<DownloadResult> {
  try {
    const response = await fetch(`/api/transactions/${kind}/${id}/document`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/pdf, application/json" },
    })

    if (!response.ok) {
      const contentType = response.headers.get("content-type") ?? ""
      const payload = contentType.includes("application/json")
        ? await response.json().catch(() => null) as unknown
        : null
      return {
        message: getErrorMessage(payload) ?? "We couldn't download this document. Please try again.",
        ok: false,
      }
    }

    const blob = await response.blob()
    const contentDisposition = response.headers.get("content-disposition")
    const filename = contentDisposition?.match(/filename="([^"]+)"/)?.[1]
      ?? `${kind === "invoice" ? "invoice" : "receipt"}-${fallbackNumber}.pdf`
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    anchor.style.display = "none"
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000)

    return { ok: true }
  } catch {
    return {
      message: "We couldn't download this document. Check your connection and try again.",
      ok: false,
    }
  }
}
