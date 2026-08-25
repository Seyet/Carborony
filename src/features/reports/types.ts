export const reportKinds = ["sales", "inventory", "expenses", "profit"] as const
export type ReportKind = (typeof reportKinds)[number]

export const inventoryReportViews = [
  "current-stock",
  "stock-movement",
  "stock-valuation",
] as const
export type InventoryReportView = (typeof inventoryReportViews)[number]

export const expenseReportViews = ["category", "date"] as const
export type ExpenseReportView = (typeof expenseReportViews)[number]

export const reportPaymentMethods = [
  "cash",
  "bank_transfer",
  "pos",
  "card",
  "other",
] as const
export type ReportPaymentMethod = (typeof reportPaymentMethods)[number]

export type ReportFilters = {
  categoryId: string
  endDate: string
  page: number
  paymentMethod: string
  productId: string
  report: ReportKind
  staffId: string
  startDate: string
  view: InventoryReportView | ExpenseReportView | ""
}

export type ReportFilterOption = {
  detail: string | null
  id: string
  label: string
}

export type ReportFilterOptions = {
  categories: ReportFilterOption[]
  paymentMethods: ReportFilterOption[]
  products: ReportFilterOption[]
  staff: ReportFilterOption[]
}

export type SalesReportSummary = {
  averageSale: number
  cogs: number
  currencyCode: string
  grossProfit: number
  revenue: number
  transactionCount: number
  unitsSold: number
}

export type SalesReportRow = {
  categoryId: string | null
  categoryName: string | null
  cogs: number
  currencyCode: string
  customerName: string
  discountAmount: number
  grossProfit: number
  paymentMethod: string
  productId: string | null
  productName: string
  quantity: number
  revenue: number
  saleDate: string
  saleId: string
  saleItemId: string
  saleNumber: string
  staffId: string
  staffName: string
  unitPrice: number
  variantName: string | null
}

export type InventoryReportSummary = {
  currencyCode: string
  inventoryValue: number
  lowStockCount: number
  outOfStockCount: number
  totalProducts: number
  totalUnits: number
}

export type InventoryStockReportRow = {
  categoryId: string | null
  categoryName: string | null
  currencyCode: string
  name: string
  productId: string
  reorderLevel: number
  sku: string | null
  stockQuantity: number
  stockStatus: string
  stockValue: number
  tracksInventory: boolean
  unitCost: number
}

export type InventoryMovementReportRow = {
  categoryId: string | null
  categoryName: string | null
  currencyCode: string
  locationName: string
  movementDate: string
  movementId: string
  movementType: string
  movementValue: number | null
  note: string | null
  occurredAt: string
  productId: string
  productName: string
  productSku: string | null
  quantityDelta: number
  staffName: string
  unitCost: number | null
  variantName: string | null
}

export type ExpenseCategoryReportRow = {
  categoryId: string
  categoryName: string
  currencyCode: string
  expenseCount: number
  percentageOfTotal: number
  totalAmount: number
}

export type ExpenseDateReportRow = {
  currencyCode: string
  expenseCount: number
  expenseDate: string
  totalAmount: number
}

export type ProfitReportSummary = {
  cogs: number
  currencyCode: string
  expenses: number
  grossProfit: number
  netProfit: number
  revenue: number
}

export type ProfitReportRow = ProfitReportSummary & {
  reportDate: string
}

export type SalesReportData = {
  kind: "sales"
  page: number
  pageCount: number
  rows: SalesReportRow[]
  summary: SalesReportSummary
  totalCount: number
}

export type InventoryReportData = {
  kind: "inventory"
  movementRows: InventoryMovementReportRow[]
  page: number
  pageCount: number
  stockRows: InventoryStockReportRow[]
  summary: InventoryReportSummary
  totalCount: number
  view: InventoryReportView
}

export type ExpenseReportData = {
  categoryRows: ExpenseCategoryReportRow[]
  dateRows: ExpenseDateReportRow[]
  kind: "expenses"
  view: ExpenseReportView
}

export type ProfitReportData = {
  kind: "profit"
  rows: ProfitReportRow[]
  summary: ProfitReportSummary
}

export type ReportsPageData = {
  businessName: string
  currencyCode: string
  filters: ReportFilters
  options: ReportFilterOptions
  reportData:
    | SalesReportData
    | InventoryReportData
    | ExpenseReportData
    | ProfitReportData
  timezone: string
  todayDate: string
}

export type ReportsQueryInput = {
  categoryId?: string
  endDate?: string
  page?: string
  paymentMethod?: string
  productId?: string
  report?: string
  staffId?: string
  startDate?: string
  view?: string
}
