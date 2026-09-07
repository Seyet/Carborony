export type PaymentAccount = {
  accountName: string
  accountLastFour: string
  bankName: string
  commissionPercent: number
  status: "creating" | "connected" | "reconciliation_required"
  providerActive: boolean
  providerVerified: boolean
}

export type PaymentSetupData = {
  account: PaymentAccount | null
  available: boolean
  supported: boolean
  mode: "test" | "live" | null
  commissionPercent: number
}

export type PaymentBank = { code: string; name: string }
export type VerifiedPaymentAccount = {
  bankCode: string
  bankName: string
  accountNumber: string
  accountName: string
}
