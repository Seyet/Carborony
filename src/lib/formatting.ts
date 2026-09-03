export type DisplayPreferences = {
  dateFormat: "day_month_year" | "month_day_year" | "year_month_day"
  locale: string
  timeFormat: "12h" | "24h"
  timeZone: string
}

function dateParts(value: Date, preferences: DisplayPreferences) {
  const parts = new Intl.DateTimeFormat(preferences.locale, {
    day: "2-digit",
    month: "2-digit",
    timeZone: preferences.timeZone,
    year: "numeric",
  }).formatToParts(value)
  return new Map(parts.map((part) => [part.type, part.value]))
}

export function formatBusinessDate(
  value: string | Date,
  preferences: DisplayPreferences,
) {
  const parts = dateParts(typeof value === "string" ? new Date(value) : value, preferences)
  const ordered = preferences.dateFormat === "month_day_year"
    ? [parts.get("month"), parts.get("day"), parts.get("year")]
    : preferences.dateFormat === "year_month_day"
      ? [parts.get("year"), parts.get("month"), parts.get("day")]
      : [parts.get("day"), parts.get("month"), parts.get("year")]
  return ordered.join("/")
}

export function formatBusinessTime(
  value: string | Date,
  preferences: DisplayPreferences,
) {
  return new Intl.DateTimeFormat(preferences.locale, {
    hour: "numeric",
    hour12: preferences.timeFormat === "12h",
    minute: "2-digit",
    timeZone: preferences.timeZone,
  }).format(typeof value === "string" ? new Date(value) : value)
}

export function formatBusinessDateTime(
  value: string | Date,
  preferences: DisplayPreferences,
) {
  return `${formatBusinessDate(value, preferences)} ${formatBusinessTime(value, preferences)}`
}

export function formatBusinessMoney(
  amount: number,
  currencyCode: string,
  locale: string,
) {
  return new Intl.NumberFormat(locale, {
    currency: currencyCode,
    currencyDisplay: "narrowSymbol",
    style: "currency",
  }).format(amount)
}

export function formatBusinessNumber(
  value: number,
  locale: string,
  maximumFractionDigits = 3,
) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value)
}
