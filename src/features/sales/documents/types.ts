export type TransactionDocumentKind = "invoice" | "order" | "sale"

export type TransactionDocumentLine = {
  discountAmount: number
  itemSource: "catalogue" | "external"
  lineTotal: number
  name: string
  quantity: number
  sku: string | null
  unitPrice: number
  variantName: string | null
}

export type TransactionDocumentData = {
  business: {
    address: string | null
    email: string | null
    name: string
    phone: string | null
    websiteUrl: string | null
  }
  channel: string | null
  currencyCode: string
  customer: {
    email: string | null
    name: string
    phone: string | null
  } | null
  discountAmount: number
  deliveryAddress: string | null
  formatting: {
    dateFormat: "day_month_year" | "month_day_year" | "year_month_day"
    locale: string
    timeFormat: "12h" | "24h"
    timeZone: string
  }
  id: string
  issuedAt: string
  items: TransactionDocumentLine[]
  kind: TransactionDocumentKind
  notes: string | null
  number: string
  paymentMethod: string
  paymentStatus: string | null
  status: string
  shippingAmount: number
  subtotalAmount: number
  taxAmount: number
  totalAmount: number
}
