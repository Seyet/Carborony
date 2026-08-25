import { createReportCsv } from "./create-csv"
import { createReportPdf } from "./create-pdf"
import { createReportXlsx } from "./create-xlsx"
import { safeFileStem } from "./format-values"
import type {
  ReportExportDocument,
  ReportExportFile,
  ReportExportFormat,
} from "./types"

export async function createReportExport(
  document: ReportExportDocument,
  format: ReportExportFormat,
): Promise<ReportExportFile> {
  const fileStem = safeFileStem(document.fileStem)

  if (format === "pdf") {
    return {
      body: await createReportPdf(document),
      fileName: `${fileStem}.pdf`,
      mimeType: "application/pdf",
    }
  }

  if (format === "excel") {
    return {
      body: createReportXlsx(document),
      fileName: `${fileStem}.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
  }

  return {
    body: createReportCsv(document),
    fileName: `${fileStem}.csv`,
    mimeType: "text/csv;charset=utf-8",
  }
}
