import type {
  ReportExportDocument,
  ReportExportValue,
} from "./types"

type CsvCell = ReportExportValue | undefined

function formatCsvCell(value: CsvCell) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : '""'
  }

  let normalized = value ?? ""

  // A leading apostrophe makes spreadsheet programs treat tenant-provided
  // formula-like content as plain text.
  if (/^\s*[=+\-@]/.test(normalized)) normalized = `'${normalized}`

  return `"${normalized.replaceAll('"', '""')}"`
}

function createRows(document: ReportExportDocument) {
  const rows: CsvCell[][] = [
    [document.title],
    ["Business", document.businessName],
    ["Currency", document.currencyCode],
    ["Timezone", document.timeZone],
    ["Generated at", document.generatedAt],
  ]

  if (document.filters.length) {
    rows.push([], ["Filters"], ["Filter", "Value"])
    document.filters.forEach((field) => rows.push([field.label, field.value]))
  }

  if (document.metrics.length) {
    rows.push([], ["Summary"], ["Metric", "Value"])
    document.metrics.forEach((field) => rows.push([field.label, field.value]))
  }

  for (const section of document.sections) {
    rows.push([], [section.title], section.columns.map((column) => column.label))

    if (section.rows.length === 0) {
      rows.push([section.emptyMessage ?? "No matching records."])
      continue
    }

    section.rows.forEach((row) => rows.push([...row]))
  }

  return rows
}

export function createReportCsv(document: ReportExportDocument) {
  const content = createRows(document)
    .map((row) => row.map((cell) => formatCsvCell(cell)).join(","))
    .join("\r\n")

  return new TextEncoder().encode(`\uFEFF${content}`)
}
