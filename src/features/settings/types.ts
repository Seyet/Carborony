export type DateFormat = "day_month_year" | "month_day_year" | "year_month_day"
export type TimeFormat = "12h" | "24h"

export type SettingsOpeningHour = {
  close: string
  day: string
  enabled: boolean
  open: string
}

export type SettingsPageData = {
  billing: {
    billingEmail: string
    billingInterval: "monthly" | "yearly" | null
    cancelAtPeriodEnd: boolean
    currencyCode: string
    currentPeriodEndsAt: string | null
    invoices: {
      amountDue: number
      amountPaid: number
      currencyCode: string
      hostedInvoiceUrl: string | null
      id: string
      invoiceNumber: string
      issuedAt: string
      status: "draft" | "open" | "paid" | "void" | "uncollectible"
    }[]
    paymentMethod: {
      brand: string
      expiryMonth: number
      expiryYear: number
      lastFour: string
    } | null
    planAmount: number
    planCode: string
    subscriptionStatus: "trialing" | "active" | "past_due" | "cancelled" | "paused"
  } | null
  business: {
    address: string | null
    categoryCode: string
    description: string | null
    email: string | null
    facebookPage: string | null
    instagramAccount: string | null
    logoUrl: string | null
    name: string
    openingHours: SettingsOpeningHour[]
    phone: string
    slug: string
    websiteUrl: string | null
    whatsappPhone: string | null
  } | null
  canManageBusiness: boolean
  canViewBusiness: boolean
  isOwner: boolean
  profile: {
    avatarUrl: string | null
    email: string
    fullName: string
    phone: string | null
    roleName: string
  }
  regional: {
    countryCode: string
    currencyCode: string
    dateFormat: DateFormat
    locale: string
    timeFormat: TimeFormat
    timezone: string
    weekStartsOn: number
  } | null
  session: {
    lastSignedInAt: string | null
    userAgent: string
  }
}

export type SettingsMutationData = {
  avatarUrl?: string | null
  logoUrl?: string | null
}
