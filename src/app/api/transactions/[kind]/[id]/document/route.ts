import { z } from "zod"

import { generateTransactionPdf } from "@/features/sales/documents/generate-transaction-pdf"
import { getTransactionDocument } from "@/features/sales/documents/server/get-transaction-document"
import { ApiError, jsonError } from "@/lib/api/server"

const paramsSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["invoice", "order", "sale"]),
})

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; kind: string }> },
) {
  try {
    const validation = paramsSchema.safeParse(await context.params)
    if (!validation.success) {
      return jsonError(400, "INVALID_DOCUMENT", "The requested document is invalid.")
    }

    const document = await getTransactionDocument(
      validation.data.kind,
      validation.data.id,
    )
    const pdf = await generateTransactionPdf(document)
    const pdfBody = new ArrayBuffer(pdf.byteLength)
    new Uint8Array(pdfBody).set(pdf)
    const filename = `${document.kind === "invoice" ? "invoice" : "receipt"}-${document.number.replace(/[^a-zA-Z0-9-]/g, "-")}.pdf`

    return new Response(pdfBody, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/pdf",
        Expires: "0",
      },
    })
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.status, error.code, error.message, error.fields)
    }

    console.error("Transaction PDF generation failed", error)
    return jsonError(500, "DOCUMENT_GENERATION_FAILED", "We couldn't generate this document. Please try again.")
  }
}
