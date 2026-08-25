export type ReportExportFormat = "csv" | "excel" | "pdf"

export type ReportExportValue = number | string | null

export type ReportExportValueKind =
  | "currency"
  | "date"
  | "datetime"
  | "integer"
  | "number"
  | "quantity"
  | "text"

export type ReportExportField = {
  kind?: ReportExportValueKind
  label: string
  value: ReportExportValue
}

export type ReportExportColumn = {
  align?: "left" | "right"
  kind?: ReportExportValueKind
  label: string
  /** Relative width used by the PDF renderer. */
  width?: number
}

export type ReportExportSection = {
  columns: readonly ReportExportColumn[]
  emptyMessage?: string
  rows: readonly (readonly ReportExportValue[])[]
  title: string
}

export type ReportExportDocument = {
  businessName: string
  currencyCode: string
  fileStem: string
  filters: readonly ReportExportField[]
  generatedAt: string
  metrics: readonly ReportExportField[]
  sections: readonly ReportExportSection[]
  timeZone: string
  title: string
}

export type ReportExportFile = {
  body: Uint8Array
  fileName: string
  mimeType: string
}
