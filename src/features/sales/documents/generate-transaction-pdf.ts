import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  PageSizes,
  rgb,
  StandardFonts,
} from "pdf-lib"

import type { TransactionDocumentData } from "./types"
import { formatBusinessDateTime, formatBusinessNumber } from "@/lib/formatting"

const pageMargin = 48
const textColor = rgb(0.11, 0.13, 0.16)
const mutedColor = rgb(0.42, 0.46, 0.51)
const lineColor = rgb(0.87, 0.89, 0.91)
const accentColor = rgb(0.08, 0.45, 0.36)
const lightBackground = rgb(0.96, 0.97, 0.97)

function pdfText(value: string) {
  return value
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?")
}

function formatAmount(currencyCode: string, amount: number, locale: string) {
  return `${currencyCode} ${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount)}`
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
  const safeText = pdfText(text)
  page.drawText(safeText, {
    color,
    font,
    size,
    x: right - font.widthOfTextAtSize(safeText, size),
    y,
  })
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = pdfText(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ""

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate
      continue
    }

    if (line) lines.push(line)
    line = word
  }

  if (line) lines.push(line)
  return lines.length ? lines : [""]
}

function drawItemsHeader(page: PDFPage, y: number, bold: PDFFont) {
  page.drawRectangle({
    color: lightBackground,
    height: 25,
    width: page.getWidth() - pageMargin * 2,
    x: pageMargin,
    y: y - 18,
  })
  page.drawText("ITEM", { color: mutedColor, font: bold, size: 8, x: pageMargin + 8, y: y - 9 })
  drawRight(page, "QTY", 318, y - 9, bold, 8, mutedColor)
  drawRight(page, "UNIT PRICE", 405, y - 9, bold, 8, mutedColor)
  drawRight(page, "DISCOUNT", 477, y - 9, bold, 8, mutedColor)
  drawRight(page, "TOTAL", page.getWidth() - pageMargin - 8, y - 9, bold, 8, mutedColor)
  return y - 28
}

export async function generateTransactionPdf(data: TransactionDocumentData) {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const documentTitle = data.kind === "invoice"
    ? "INVOICE"
    : data.kind === "order" ? "ORDER RECEIPT" : "SALES RECEIPT"
  const fileTitle = `${documentTitle} ${data.number}`

  pdf.setTitle(fileTitle)
  pdf.setAuthor(data.business.name)
  pdf.setCreator("Carborony")
  pdf.setProducer("Carborony")
  pdf.setSubject(`${documentTitle} for ${formatAmount(data.currencyCode, data.totalAmount, data.formatting.locale)}`)

  let page = pdf.addPage(PageSizes.A4)
  let y = page.getHeight() - pageMargin

  const addContinuationPage = (includeItemsHeader = true) => {
    page = pdf.addPage(PageSizes.A4)
    const pageHeight = page.getHeight()
    page.drawText(pdfText(data.business.name), {
      color: textColor,
      font: bold,
      size: 12,
      x: pageMargin,
      y: pageHeight - pageMargin,
    })
    drawRight(page, `${documentTitle} ${data.number}`, page.getWidth() - pageMargin, pageHeight - pageMargin, bold, 10, mutedColor)
    page.drawLine({
      color: lineColor,
      end: { x: page.getWidth() - pageMargin, y: pageHeight - pageMargin - 12 },
      start: { x: pageMargin, y: pageHeight - pageMargin - 12 },
      thickness: 1,
    })
    y = includeItemsHeader
      ? drawItemsHeader(page, pageHeight - pageMargin - 36, bold)
      : pageHeight - pageMargin - 40
  }

  page.drawText(pdfText(data.business.name), {
    color: textColor,
    font: bold,
    size: 21,
    x: pageMargin,
    y,
  })
  page.drawText("Powered by Carborony", {
    color: mutedColor,
    font: regular,
    size: 8,
    x: pageMargin,
    y: y - 16,
  })
  drawRight(page, documentTitle, page.getWidth() - pageMargin, y, bold, 19, accentColor)
  drawRight(page, data.number, page.getWidth() - pageMargin, y - 18, regular, 9, mutedColor)

  y -= 52
  page.drawLine({
    color: lineColor,
    end: { x: page.getWidth() - pageMargin, y },
    start: { x: pageMargin, y },
    thickness: 1,
  })

  const businessDetails = [
    data.business.address,
    data.business.phone,
    data.business.email,
    data.business.websiteUrl,
  ].filter((value): value is string => Boolean(value))

  y -= 24
  page.drawText("FROM", { color: mutedColor, font: bold, size: 8, x: pageMargin, y })
  let businessY = y - 17
  for (const detail of businessDetails.slice(0, 4)) {
    page.drawText(pdfText(detail), { color: textColor, font: regular, size: 9, x: pageMargin, y: businessY })
    businessY -= 13
  }

  const metaX = 338
  const metaRight = page.getWidth() - pageMargin
  const metaRows = [
    ["Issued", formatBusinessDateTime(data.issuedAt, data.formatting)],
    ...(data.channel ? [["Channel", data.channel.replaceAll("_", " ")]] : []),
    ["Status", data.status],
    ["Payment method", data.paymentMethod],
    ...(data.paymentStatus ? [["Payment status", data.paymentStatus]] : []),
  ]
  let metaY = y
  for (const [label, value] of metaRows) {
    page.drawText(label.toUpperCase(), { color: mutedColor, font: bold, size: 8, x: metaX, y: metaY })
    drawRight(page, value, metaRight, metaY, regular, 9)
    metaY -= 18
  }

  y = Math.min(businessY, metaY) - 18
  const deliveryAddressLines = data.deliveryAddress
    ? wrapText(`Deliver to: ${data.deliveryAddress}`, regular, 8, page.getWidth() - pageMargin * 2 - 24).slice(0, 2)
    : []
  const customerBoxHeight = deliveryAddressLines.length ? 82 : 58
  page.drawRectangle({
    borderColor: lineColor,
    borderWidth: 1,
    color: rgb(1, 1, 1),
    height: customerBoxHeight,
    width: page.getWidth() - pageMargin * 2,
    x: pageMargin,
    y: y - customerBoxHeight + 11,
  })
  page.drawText(data.customer ? "BILL TO" : "CUSTOMER", {
    color: mutedColor,
    font: bold,
    size: 8,
    x: pageMargin + 12,
    y: y - 13,
  })
  page.drawText(pdfText(data.customer?.name ?? "Walk-in customer"), {
    color: textColor,
    font: bold,
    size: 10,
    x: pageMargin + 12,
    y: y - 30,
  })
  const customerContact = [data.customer?.phone, data.customer?.email].filter(Boolean).join("  |  ")
  if (customerContact) {
    page.drawText(pdfText(customerContact), {
      color: mutedColor,
      font: regular,
      size: 8,
      x: pageMargin + 200,
      y: y - 30,
    })
  }

  if (deliveryAddressLines.length) {
    let addressY = y - 48
    for (const line of deliveryAddressLines) {
      page.drawText(pdfText(line), {
        color: mutedColor,
        font: regular,
        size: 8,
        x: pageMargin + 12,
        y: addressY,
      })
      addressY -= 10
    }
  }

  y -= customerBoxHeight + 20
  y = drawItemsHeader(page, y, bold)

  for (const item of data.items) {
    const secondary = [item.variantName, item.sku, item.itemSource === "external" ? "External item" : null]
      .filter(Boolean)
      .join(" - ")
    const nameLines = wrapText(item.name, bold, 9, 210).slice(0, 2)
    const rowHeight = Math.max(38, nameLines.length * 11 + (secondary ? 16 : 7))

    if (y - rowHeight < 122) addContinuationPage()

    let nameY = y - 14
    for (const line of nameLines) {
      page.drawText(line, { color: textColor, font: bold, size: 9, x: pageMargin + 8, y: nameY })
      nameY -= 11
    }
    if (secondary) {
      page.drawText(pdfText(secondary), { color: mutedColor, font: regular, size: 7.5, x: pageMargin + 8, y: nameY - 1 })
    }

    drawRight(page, formatBusinessNumber(item.quantity, data.formatting.locale), 318, y - 14, regular, 8.5)
    drawRight(page, formatAmount(data.currencyCode, item.unitPrice, data.formatting.locale), 405, y - 14, regular, 8.5)
    drawRight(page, formatAmount(data.currencyCode, item.discountAmount, data.formatting.locale), 477, y - 14, regular, 8.5)
    drawRight(page, formatAmount(data.currencyCode, item.lineTotal, data.formatting.locale), page.getWidth() - pageMargin - 8, y - 14, bold, 8.5)

    y -= rowHeight
    page.drawLine({
      color: lineColor,
      end: { x: page.getWidth() - pageMargin, y },
      start: { x: pageMargin, y },
      thickness: 0.6,
    })
  }

  const summaryRows: Array<[string, number]> = [
    ["Subtotal", data.subtotalAmount],
    ["Discount", -data.discountAmount],
    ...(data.shippingAmount ? [["Shipping", data.shippingAmount] as [string, number]] : []),
    ["Tax", data.taxAmount],
  ]
  const noteLines = data.notes
    ? wrapText(`Order note: ${data.notes}`, regular, 8, page.getWidth() - pageMargin * 2).slice(0, 4)
    : []
  const summarySpace = 126 + summaryRows.length * 18
    + (noteLines.length ? 22 + noteLines.length * 11 : 0)

  if (y < summarySpace) {
    addContinuationPage(false)
    page.drawText("SUMMARY", {
      color: mutedColor,
      font: bold,
      size: 8,
      x: pageMargin,
      y,
    })
    y -= 14
  }

  y -= 24
  const summaryLeft = 330
  const summaryRight = page.getWidth() - pageMargin
  for (const [label, amount] of summaryRows) {
    page.drawText(label, { color: mutedColor, font: regular, size: 9, x: summaryLeft, y })
    drawRight(page, formatAmount(data.currencyCode, amount, data.formatting.locale), summaryRight, y, regular, 9)
    y -= 18
  }

  page.drawRectangle({
    color: accentColor,
    height: 38,
    width: summaryRight - summaryLeft + 12,
    x: summaryLeft - 6,
    y: y - 12,
  })
  const totalLabel = data.kind === "invoice"
    ? "AMOUNT DUE"
    : data.kind === "order" && data.paymentStatus !== "paid" ? "ORDER TOTAL" : "TOTAL PAID"
  page.drawText(totalLabel, {
    color: rgb(1, 1, 1),
    font: bold,
    size: 10,
    x: summaryLeft + 4,
    y: y + 2,
  })
  drawRight(page, formatAmount(data.currencyCode, data.totalAmount, data.formatting.locale), summaryRight - 4, y + 1, bold, 11, rgb(1, 1, 1))

  y -= 52
  page.drawText(data.kind === "invoice" ? "Thank you. Please reference the invoice number when making payment." : "Thank you for your business.", {
    color: textColor,
    font: bold,
    size: 9,
    x: pageMargin,
    y,
  })

  if (noteLines.length) {
    y -= 22
    for (const line of noteLines) {
      page.drawText(line, { color: mutedColor, font: regular, size: 8, x: pageMargin, y })
      y -= 11
    }
  }

  const pages = pdf.getPages()
  pages.forEach((pdfPage, index) => {
    const footerY = 28
    pdfPage.drawLine({
      color: lineColor,
      end: { x: pdfPage.getWidth() - pageMargin, y: footerY + 12 },
      start: { x: pageMargin, y: footerY + 12 },
      thickness: 0.6,
    })
    pdfPage.drawText("Generated securely by Carborony", {
      color: mutedColor,
      font: regular,
      size: 7,
      x: pageMargin,
      y: footerY,
    })
    drawRight(pdfPage, `Page ${index + 1} of ${pages.length}`, pdfPage.getWidth() - pageMargin, footerY, regular, 7, mutedColor)
  })

  return pdf.save()
}
