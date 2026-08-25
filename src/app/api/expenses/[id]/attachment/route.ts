import { z } from "zod"

import { getExpenseAttachmentDownload } from "@/features/expenses/server/manage-attachment"
import { ApiError, jsonError } from "@/lib/api/server"

const paramsSchema = z.object({ id: z.uuid() })

function safeContentDisposition(fileName: string) {
  const fallback = fileName
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .replace(/^[. ]+|[. ]+$/g, "")
    .slice(0, 180) || "expense-attachment"
  const encoded = encodeURIComponent(fileName)
    .replace(/[!'()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    )

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const validation = paramsSchema.safeParse(await context.params)
    if (!validation.success) {
      return jsonError(
        400,
        "INVALID_EXPENSE",
        "The requested expense is invalid.",
      )
    }

    const attachment = await getExpenseAttachmentDownload(validation.data.id)

    return new Response(attachment.body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": safeContentDisposition(attachment.fileName),
        "Content-Length": String(attachment.body.size),
        "Content-Type": attachment.mimeType,
        Expires: "0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(
        error.status,
        error.code,
        error.message,
        error.fields,
      )
    }

    console.error("Expense attachment download failed", error)
    return jsonError(
      500,
      "ATTACHMENT_DOWNLOAD_FAILED",
      "We couldn't download this attachment. Please try again.",
    )
  }
}
