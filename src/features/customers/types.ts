export const customerSegments = [
  "new",
  "returning",
  "vip",
  "inactive",
  "high_spender",
] as const

export type CustomerSegment = (typeof customerSegments)[number]

export type CustomerListItem = {
  averageOrder: number
  email: string | null
  id: string
  lastProductName: string | null
  lastPurchaseAt: string | null
  name: string
  phone: string | null
  purchaseCount: number
  segment: CustomerSegment
  tags: string[]
  totalSpent: number
}

export type CustomerSegmentMetric = {
  count: number
  revenue: number
  segment: CustomerSegment
}

export type CustomersPageData = {
  currencyCode: string
  items: CustomerListItem[]
  page: number
  pageCount: number
  segmentMetrics: CustomerSegmentMetric[]
  timezone: string
  totalCount: number
}

export type CustomerProfile = CustomerListItem & {
  address: string | null
  birthday: string | null
  createdAt: string
  notes: string | null
  source: string
}

export type CustomerPurchase = {
  currencyCode: string
  id: string
  issuedAt: string
  kind: string
  number: string
  paymentStatus: string
  productName: string | null
  status: string
  totalAmount: number
}

export type CustomerDetailsData = {
  currencyCode: string
  history: CustomerPurchase[]
  historyPage: number
  historyPageCount: number
  historyTotalCount: number
  profile: CustomerProfile
  timezone: string
}

export type SaveCustomerData = {
  customerId: string
  wasCreated: boolean
}
