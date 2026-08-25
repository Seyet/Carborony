import type {
  ReportExportDocument,
  ReportExportValue,
} from "./types"

const textEncoder = new TextEncoder()

type WorksheetRow = {
  cells: readonly ReportExportValue[]
  style?: number
}

function xmlText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function columnName(index: number) {
  let current = index + 1
  let name = ""

  while (current > 0) {
    const remainder = (current - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    current = Math.floor((current - 1) / 26)
  }

  return name
}

function cellXml(value: ReportExportValue, row: number, column: number, style = 0) {
  const reference = `${columnName(column)}${row}`
  const styleAttribute = style > 0 ? ` s="${style}"` : ""

  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}"${styleAttribute}><v>${value}</v></c>`
  }

  const text = value === null ? "" : String(value)
  return `<c r="${reference}" t="inlineStr"${styleAttribute}><is><t xml:space="preserve">${xmlText(text)}</t></is></c>`
}

function worksheetRows(document: ReportExportDocument) {
  const rows: WorksheetRow[] = [
    { cells: [document.title], style: 1 },
    { cells: ["Business", document.businessName] },
    { cells: ["Currency", document.currencyCode] },
    { cells: ["Timezone", document.timeZone] },
    { cells: ["Generated at", document.generatedAt] },
  ]

  if (document.filters.length) {
    rows.push(
      { cells: [] },
      { cells: ["Filters"], style: 2 },
      { cells: ["Filter", "Value"], style: 3 },
      ...document.filters.map((field) => ({ cells: [field.label, field.value] })),
    )
  }

  if (document.metrics.length) {
    rows.push(
      { cells: [] },
      { cells: ["Summary"], style: 2 },
      { cells: ["Metric", "Value"], style: 3 },
      ...document.metrics.map((field) => ({ cells: [field.label, field.value] })),
    )
  }

  for (const section of document.sections) {
    rows.push(
      { cells: [] },
      { cells: [section.title], style: 2 },
      { cells: section.columns.map((column) => column.label), style: 3 },
    )

    if (section.rows.length === 0) {
      rows.push({ cells: [section.emptyMessage ?? "No matching records."] })
    } else {
      section.rows.forEach((row) => rows.push({ cells: row }))
    }
  }

  return rows
}

function worksheetXml(document: ReportExportDocument) {
  const rows = worksheetRows(document)
  const maximumColumns = Math.max(1, ...rows.map((row) => row.cells.length))
  const columnWidths = Array.from({ length: maximumColumns }, (_, column) => {
    const maximumLength = Math.max(
      8,
      ...rows.map((row) => String(row.cells[column] ?? "").length),
    )
    return Math.min(48, maximumLength + 2)
  })
  const columns = columnWidths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join("")
  const body = rows.map((row, rowIndex) => {
    const cells = row.cells
      .map((value, columnIndex) => cellXml(value, rowIndex + 1, columnIndex, row.style))
      .join("")
    return `<row r="${rowIndex + 1}">${cells}</row>`
  }).join("")

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${columns}</cols>
  <sheetData>${body}</sheetData>
</worksheet>`
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff

  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
  }

  return (crc ^ 0xffffffff) >>> 0
}

function concatBytes(parts: readonly Uint8Array[]) {
  const length = parts.reduce((total, part) => total + part.byteLength, 0)
  const result = new Uint8Array(length)
  let offset = 0

  for (const part of parts) {
    result.set(part, offset)
    offset += part.byteLength
  }

  return result
}

function zipArchive(files: readonly { content: string; name: string }[]) {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let localOffset = 0

  for (const file of files) {
    const name = textEncoder.encode(file.name)
    const data = textEncoder.encode(file.content)
    const checksum = crc32(data)
    const localHeader = new Uint8Array(30 + name.byteLength)
    const localView = new DataView(localHeader.buffer)

    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0x0800, true)
    localView.setUint16(8, 0, true)
    localView.setUint32(14, checksum, true)
    localView.setUint32(18, data.byteLength, true)
    localView.setUint32(22, data.byteLength, true)
    localView.setUint16(26, name.byteLength, true)
    localHeader.set(name, 30)

    const centralHeader = new Uint8Array(46 + name.byteLength)
    const centralView = new DataView(centralHeader.buffer)

    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0x0800, true)
    centralView.setUint16(10, 0, true)
    centralView.setUint32(16, checksum, true)
    centralView.setUint32(20, data.byteLength, true)
    centralView.setUint32(24, data.byteLength, true)
    centralView.setUint16(28, name.byteLength, true)
    centralView.setUint32(42, localOffset, true)
    centralHeader.set(name, 46)

    localParts.push(localHeader, data)
    centralParts.push(centralHeader)
    localOffset += localHeader.byteLength + data.byteLength
  }

  const centralDirectory = concatBytes(centralParts)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)

  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, files.length, true)
  endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralDirectory.byteLength, true)
  endView.setUint32(16, localOffset, true)

  return concatBytes([...localParts, centralDirectory, end])
}

export function createReportXlsx(document: ReportExportDocument) {
  return zipArchive([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      name: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="10"/><name val="Aptos"/></font>
    <font><b/><sz val="16"/><color rgb="FF143C35"/><name val="Aptos Display"/></font>
    <font><b/><sz val="10"/><name val="Aptos"/></font>
  </fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F3EF"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0"/>
  </cellXfs>
</styleSheet>`,
    },
    { name: "xl/worksheets/sheet1.xml", content: worksheetXml(document) },
  ])
}
