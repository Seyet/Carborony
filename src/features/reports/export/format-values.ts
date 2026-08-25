import type {
  ReportExportDocument,
  ReportExportValue,
  ReportExportValueKind,
} from "./types"

function numberFormatter(
  maximumFractionDigits: number,
  minimumFractionDigits = 0,
) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits,
  })
}

function formatDate(value: string, timeZone: string, includeTime: boolean) {
  const date = includeTime
    ? new Date(value)
    : new Date(`${value.slice(0, 10)}T00:00:00Z`)

  if (Number.isNaN(date.getTime())) return value

  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      ...(includeTime ? { timeStyle: "short" as const, timeZone } : {}),
      ...(!includeTime ? { timeZone: "UTC" } : {}),
    }).format(date)
  } catch {
    return value
  }
}

export function formatReportDisplayValue(
  value: ReportExportValue,
  kind: ReportExportValueKind = "text",
  document: Pick<ReportExportDocument, "currencyCode" | "timeZone">,
) {
  if (value === null || value === "") return "-"

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "-"

    if (kind === "currency") {
      return `${document.currencyCode} ${numberFormatter(2, 2).format(value)}`
    }
    if (kind === "integer") return numberFormatter(0).format(value)
    if (kind === "quantity") return numberFormatter(3).format(value)
    if (kind === "number") return numberFormatter(2).format(value)
  }

  if (typeof value === "string" && kind === "date") {
    return formatDate(value, document.timeZone, false)
  }
  if (typeof value === "string" && kind === "datetime") {
    return formatDate(value, document.timeZone, true)
  }

  return String(value)
}

export function safePdfText(value: string) {
  return value
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?")
}

export function safeFileStem(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)

  return normalized || "business-report"
}
