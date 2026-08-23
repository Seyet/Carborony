export type PosVariant = {
  costPrice: number
  id: string
  name: string
  sellingPrice: number
  sku: string | null
  stock: number | null
}

export type PosProduct = {
  id: string
  name: string
  sellingPrice: number
  sku: string | null
  stock: number | null
  variants: PosVariant[]
}

export type PosCustomer = {
  id: string
  name: string
  phone: string | null
}

export type PosCatalog = {
  currencyCode: string
  customers: PosCustomer[]
  products: PosProduct[]
}

export type CompleteSaleData = {
  saleId: string
  saleNumber: string
  totalAmount: number
}

export type CreateInvoiceData = {
  invoiceId: string
  invoiceNumber: string
  totalAmount: number
}
