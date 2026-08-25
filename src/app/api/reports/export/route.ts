import { createReportExport } from "@/features/reports/export/create-report-export"
import { reportExportQuerySchema } from "@/features/reports/export/schema"
import { getReportExportDocument } from "@/features/reports/server/get-report-export"
import { ApiError, jsonError } from "@/lib/api/server"

function responseBody(bytes: Uint8Array) {
  const body = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(body).set(bytes)
  return body
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams
    const validation = reportExportQuerySchema.safeParse({
      categoryId: searchParams.get("categoryId") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
      format: searchParams.get("format") ?? undefined,
      paymentMethod: searchParams.get("paymentMethod") ?? undefined,
      productId: searchParams.get("productId") ?? undefined,
      report: searchParams.get("report") ?? undefined,
      staffId: searchParams.get("staffId") ?? undefined,
      startDate: searchParams.get("startDate") ?? undefined,
      view: searchParams.get("view") ?? undefined,
    })

    if (!validation.success) {
      return jsonError(
        400,
        "INVALID_REPORT_EXPORT",
        validation.error.issues[0]?.message
          ?? "Check the report export options and try again.",
      )
    }

    const document = await getReportExportDocument(validation.data)
    const file = await createReportExport(document, validation.data.format)

    return new Response(responseBody(file.body), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
        "Content-Length": String(file.body.byteLength),
        "Content-Type": file.mimeType,
        Expires: "0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.status, error.code, error.message, error.fields)
    }

    console.error("Report export generation failed", error)
    return jsonError(
      500,
      "REPORT_EXPORT_FAILED",
      "We couldn't generate this report export. Please try again.",
    )
  }
}
