export const expensePaymentMethods = [
  "cash",
  "bank_transfer",
  "pos",
  "card",
  "other",
] as const

export type ExpensePaymentMethod = (typeof expensePaymentMethods)[number]
export type ExpenseStatus = "recorded" | "voided"

export type ExpenseAttachment = {
  fileName: string
  fileSize: number
  mimeType: string
}

export type ExpenseCategoryOption = {
  id: string
  name: string
}

export type ExpenseStaffOption = {
  id: string
  name: string
  roleName: string
}

export type ExpenseListItem = {
  amount: number
  attachment: ExpenseAttachment | null
  categoryId: string
  categoryName: string
  createdAt: string
  currencyCode: string
  date: string
  description: string | null
  id: string
  name: string
  paymentMethod: ExpensePaymentMethod
  staffMemberId: string | null
  staffMemberName: string | null
  status: ExpenseStatus
}

export type ExpenseMetrics = {
  recordedTotal: number
  thisMonthTotal: number
  topCategoryName: string | null
  totalCount: number
}

export type ExpensePageData = {
  categories: ExpenseCategoryOption[]
  currencyCode: string
  items: ExpenseListItem[]
  metrics: ExpenseMetrics
  page: number
  pageCount: number
  staffMembers: ExpenseStaffOption[]
  timezone: string
  todayDate: string
  totalCount: number
}
