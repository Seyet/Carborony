import type { TransactionDocumentKind } from "../documents/types"

export type SalesHistoryItem = {
  customerName: string
  documentNumber: string
  id: string
  issuedAt: string
  kind: TransactionDocumentKind
  paymentMethod: string
  status: string
  totalAmount: number
  currencyCode: string
}
