import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  PageSizes,
  rgb,
  StandardFonts,
} from "pdf-lib"

import { formatReportDisplayValue, safePdfText } from "./format-values"
import type {
  ReportExportColumn,
  ReportExportDocument,
  ReportExportSection,
  ReportExportValue,
} from "./types"

const pageMargin = 34
const pageBottom = 38
const textColor = rgb(0.11, 0.13, 0.16)
const mutedColor = rgb(0.42, 0.46, 0.51)
const lineColor = rgb(0.85, 0.88, 0.88)
const accentColor = rgb(0.08, 0.45, 0.36)
const headerBackground = rgb(0.91, 0.96, 0.94)
const alternateBackground = rgb(0.975, 0.982, 0.98)
const numericKinds = new Set(["currency", "integer", "number", "quantity"])

function fitText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const normalized = safePdfText(text)
  if (font.widthOfTextAtSize(normalized, size) <= maxWidth) return normalized

  const ellipsis = "..."
  let value = normalized
  while (value.length > 0 && font.widthOfTextAtSize(`${value}${ellipsis}`, size) > maxWidth) {
    value = value.slice(0, -1)
  }

  return value ? `${value}${ellipsis}` : ""
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const normalized = safePdfText(text).trim()
  if (!normalized) return [""]
  if (font.widthOfTextAtSize(normalized, size) <= maxWidth) return [normalized]

  const words = normalized.split(/\s+/)
  const firstLine: string[] = []
  let consumed = 0

  for (const word of words) {
    const candidate = [...firstLine, word].join(" ")
    if (font.widthOfTextAtSize(candidate, size) > maxWidth) break
    firstLine.push(word)
    consumed += 1
  }

  if (firstLine.length === 0) {
    return [fitText(normalized, font, size, maxWidth)]
  }

  return [
    firstLine.join(" "),
    fitText(words.slice(consumed).join(" "), font, size, maxWidth),
  ].filter(Boolean)
}

function formatTableValue(
  value: ReportExportValue,
  column: ReportExportColumn,
  document: ReportExportDocument,
) {
  if (typeof value === "number" && column.kind === "currency") {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(value)
  }

  return formatReportDisplayValue(value, column.kind, document)
}

function numericFontSize(
  text: string,
  font: PDFFont,
  preferredSize: number,
  maxWidth: number,
) {
  const width = font.widthOfTextAtSize(text, preferredSize)

  if (width <= maxWidth || width === 0) return preferredSize

  // Dense financial reports use A3 landscape below. Scaling numeric cells as
  // a final guard preserves every digit instead of silently ellipsizing money.
  return Math.max(4.5, preferredSize * maxWidth / width)
}

function drawRight(
  page: PDFPage,
  text: string,
  right: number,
  y: number,
  font: PDFFont,
  size: number,
  color = textColor,
) {
  const normalized = safePdfText(text)
  page.drawText(normalized, {
    color,
    font,
    size,
    x: right - font.widthOfTextAtSize(normalized, size),
    y,
  })
}

function columnWidths(columns: readonly ReportExportColumn[], availableWidth: number) {
  const totalWeight = columns.reduce((total, column) => total + (column.width ?? 1), 0)
  return columns.map((column) => availableWidth * (column.width ?? 1) / totalWeight)
}

function drawTableHeader(
  page: PDFPage,
  section: ReportExportSection,
  y: number,
  bold: PDFFont,
) {
  const tableWidth = page.getWidth() - pageMargin * 2
  const widths = columnWidths(section.columns, tableWidth)

  page.drawRectangle({
    color: headerBackground,
    height: 22,
    width: tableWidth,
    x: pageMargin,
    y: y - 17,
  })

  let x = pageMargin
  section.columns.forEach((column, index) => {
    const text = fitText(column.label.toUpperCase(), bold, 7.5, widths[index] - 10)
    const textX = column.align === "right"
      ? x + widths[index] - 5 - bold.widthOfTextAtSize(text, 7.5)
      : x + 5
    page.drawText(text, { color: mutedColor, font: bold, size: 7.5, x: textX, y: y - 9 })
    x += widths[index]
  })

  return { widths, y: y - 25 }
}

function drawTableRow(
  page: PDFPage,
  columns: readonly ReportExportColumn[],
  row: readonly ReportExportValue[],
  widths: readonly number[],
  y: number,
  regular: PDFFont,
  document: ReportExportDocument,
  alternate: boolean,
) {
  const tableWidth = page.getWidth() - pageMargin * 2
  const formattedCells = columns.map((column, index) => {
    const rawValue = row[index] ?? null
    const value = formatTableValue(rawValue, column, document)
    const numeric = typeof rawValue === "number"
      && numericKinds.has(column.kind ?? "")

    if (numeric) {
      return {
        lines: [value],
        size: numericFontSize(value, regular, 7.6, widths[index] - 10),
      }
    }

    return {
      lines: wrapText(value, regular, 7.6, widths[index] - 10),
      size: 7.6,
    }
  })
  const lineCount = Math.max(1, ...formattedCells.map((cell) => cell.lines.length))
  const rowHeight = lineCount > 1 ? 30 : 21

  if (alternate) {
    page.drawRectangle({
      color: alternateBackground,
      height: rowHeight,
      width: tableWidth,
      x: pageMargin,
      y: y - rowHeight + 6,
    })
  }

  let x = pageMargin
  columns.forEach((column, index) => {
    const cell = formattedCells[index]
    const alignRight = column.align === "right"
      || ["currency", "integer", "number", "quantity"].includes(column.kind ?? "")
    cell.lines.forEach((text, lineIndex) => {
      const textX = alignRight
        ? x + widths[index] - 5 - regular.widthOfTextAtSize(text, cell.size)
        : x + 5
      page.drawText(text, {
        color: textColor,
        font: regular,
        size: cell.size,
        x: textX,
        y: y - 8 - lineIndex * 9,
      })
    })
    x += widths[index]
  })

  page.drawLine({
    color: lineColor,
    end: { x: page.getWidth() - pageMargin, y: y - rowHeight + 6 },
    start: { x: pageMargin, y: y - rowHeight + 6 },
    thickness: 0.4,
  })

  return y - rowHeight
}

export async function createReportPdf(document: ReportExportDocument) {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const pageSize: [number, number] = document.sections.some(
    (section) => section.columns.length > 9,
  )
    ? [PageSizes.A3[1], PageSizes.A3[0]]
    : [PageSizes.A4[1], PageSizes.A4[0]]
  let page = pdf.addPage(pageSize)
  let y = page.getHeight() - pageMargin

  pdf.setTitle(document.title)
  pdf.setAuthor(document.businessName)
  pdf.setCreator("Carborony")
  pdf.setProducer("Carborony")
  pdf.setSubject(`${document.title} for ${document.businessName}`)

  const addPage = () => {
    page = pdf.addPage(pageSize)
    const top = page.getHeight() - pageMargin
    page.drawText(safePdfText(document.businessName), {
      color: textColor,
      font: bold,
      size: 11,
      x: pageMargin,
      y: top,
    })
    drawRight(page, document.title, page.getWidth() - pageMargin, top, bold, 9, mutedColor)
    page.drawLine({
      color: lineColor,
      end: { x: page.getWidth() - pageMargin, y: top - 11 },
      start: { x: pageMargin, y: top - 11 },
      thickness: 0.7,
    })
    y = top - 28
  }

  page.drawText(safePdfText(document.businessName), {
    color: textColor,
    font: bold,
    size: 18,
    x: pageMargin,
    y,
  })
  page.drawText("Powered by Carborony", {
    color: mutedColor,
    font: regular,
    size: 7.5,
    x: pageMargin,
    y: y - 14,
  })
  drawRight(page, document.title.toUpperCase(), page.getWidth() - pageMargin, y, bold, 16, accentColor)
  drawRight(
    page,
    `Generated ${formatReportDisplayValue(document.generatedAt, "datetime", document)}`,
    page.getWidth() - pageMargin,
    y - 15,
    regular,
    7.5,
    mutedColor,
  )

  y -= 42
  page.drawLine({
    color: lineColor,
    end: { x: page.getWidth() - pageMargin, y },
    start: { x: pageMargin, y },
    thickness: 0.8,
  })
  y -= 20

  const details = [
    { label: "Currency", value: document.currencyCode },
    { label: "Timezone", value: document.timeZone },
    ...document.filters.map((field) => ({
      label: field.label,
      value: formatReportDisplayValue(field.value, field.kind, document),
    })),
  ]
  const detailWidth = (page.getWidth() - pageMargin * 2) / Math.min(4, Math.max(1, details.length))

  details.forEach((detail, index) => {
    const column = index % 4
    const row = Math.floor(index / 4)
    const x = pageMargin + column * detailWidth
    const detailY = y - row * 30
    page.drawText(safePdfText(detail.label.toUpperCase()), {
      color: mutedColor,
      font: bold,
      size: 6.8,
      x,
      y: detailY,
    })
    page.drawText(fitText(String(detail.value), regular, 8.2, detailWidth - 12), {
      color: textColor,
      font: regular,
      size: 8.2,
      x,
      y: detailY - 12,
    })
  })
  y -= Math.ceil(details.length / 4) * 30 + 10

  if (document.metrics.length) {
    const metricWidth = (page.getWidth() - pageMargin * 2 - 8 * (document.metrics.length - 1))
      / document.metrics.length

    document.metrics.forEach((metric, index) => {
      const x = pageMargin + index * (metricWidth + 8)
      const metricValue = formatReportDisplayValue(
        metric.value,
        metric.kind,
        document,
      )
      const numericMetric = typeof metric.value === "number"
        && numericKinds.has(metric.kind ?? "")
      const metricValueSize = numericMetric
        ? numericFontSize(metricValue, bold, 11, metricWidth - 14)
        : 11
      page.drawRectangle({
        borderColor: lineColor,
        borderWidth: 0.6,
        color: rgb(1, 1, 1),
        height: 45,
        width: metricWidth,
        x,
        y: y - 35,
      })
      page.drawText(fitText(metric.label.toUpperCase(), bold, 6.7, metricWidth - 14), {
        color: mutedColor,
        font: bold,
        size: 6.7,
        x: x + 7,
        y: y - 9,
      })
      page.drawText(
        numericMetric
          ? metricValue
          : fitText(metricValue, bold, metricValueSize, metricWidth - 14),
        {
          color: textColor,
          font: bold,
          size: metricValueSize,
          x: x + 7,
          y: y - 27,
        },
      )
    })
    y -= 58
  }

  for (const section of document.sections) {
    if (y < pageBottom + 65) addPage()

    page.drawText(safePdfText(section.title), {
      color: textColor,
      font: bold,
      size: 10.5,
      x: pageMargin,
      y,
    })
    y -= 10

    let header = drawTableHeader(page, section, y, bold)
    y = header.y

    if (section.rows.length === 0) {
      page.drawText(safePdfText(section.emptyMessage ?? "No matching records."), {
        color: mutedColor,
        font: regular,
        size: 8.5,
        x: pageMargin + 5,
        y: y - 7,
      })
      y -= 30
      continue
    }

    section.rows.forEach((row, rowIndex) => {
      if (y < pageBottom + 32) {
        addPage()
        page.drawText(safePdfText(`${section.title} (continued)`), {
          color: textColor,
          font: bold,
          size: 10,
          x: pageMargin,
          y,
        })
        y -= 10
        header = drawTableHeader(page, section, y, bold)
        y = header.y
      }

      y = drawTableRow(
        page,
        section.columns,
        row,
        header.widths,
        y,
        regular,
        document,
        rowIndex % 2 === 1,
      )
    })

    y -= 18
  }

  const pages = pdf.getPages()
  pages.forEach((currentPage, index) => {
    const footer = `Page ${index + 1} of ${pages.length}`
    drawRight(
      currentPage,
      footer,
      currentPage.getWidth() - pageMargin,
      18,
      regular,
      7,
      mutedColor,
    )
  })

  return pdf.save()
}
