export type OrderStatus = "cancelled" | "completed" | "confirmed" | "pending" | "processing" | "ready" | "refunded"

export type OrderMetrics = {
  completed: number
  pending: number
  processing: number
  ready: number
  total: number
}

export type OrderListItem = {
  buyerName: string
  buyerPhone: string | null
  channel: string
  currencyCode: string
  id: string
  itemCount: number
  number: string
  paymentStatus: string
  placedAt: string
  status: OrderStatus
  totalAmount: number
}

export type OrderLineItem = {
  discountAmount: number
  id: string
  itemSource: string
  lineTotal: number
  name: string
  quantity: number
  sku: string | null
  unitPrice: number
  variantName: string | null
}

export type OrderStatusHistoryItem = {
  changedBy: string
  createdAt: string
  id: string
  newStatus: string
  note: string | null
  previousStatus: string | null
}

export type OrderDetailsData = {
  buyerEmail: string | null
  buyerName: string
  buyerPhone: string | null
  channel: string
  completedAt: string | null
  currencyCode: string
  deliveryAddress: string | null
  deliveryZoneName: string | null
  discountAmount: number
  fulfillmentStatus: string
  formatting: {
    dateFormat: "day_month_year" | "month_day_year" | "year_month_day"
    locale: string
    timeFormat: "12h" | "24h"
    timeZone: string
  }
  history: OrderStatusHistoryItem[]
  id: string
  items: OrderLineItem[]
  notes: string | null
  number: string
  paymentStatus: string
  placedAt: string
  shippingAmount: number
  status: OrderStatus
  subtotalAmount: number
  taxAmount: number
  totalAmount: number
}

export type OrdersPageData = {
  items: OrderListItem[]
  metrics: OrderMetrics
  page: number
  pageCount: number
  timezone: string
  totalCount: number
}

export type CreateOrderData = {
  orderId: string
  orderNumber: string
  totalAmount: number
}

export type UpdateOrderStatusData = {
  currentStatus: string
  orderId: string
  previousStatus: string
}
