export type StorefrontStatus = "draft" | "paused" | "published"

export type StorefrontDeliveryZone = {
  coverageDetails: string | null
  deliveryFee: number
  id: string
  isActive: boolean
  name: string
  position: number
}

export type StorefrontCopy = {
  catalogueDescription: string
  catalogueEyebrow: string
  catalogueTitle: string
  footerTagline: string
  heroCtaLabel: string
  heroEyebrow: string
  trustOneDescription: string
  trustOneTitle: string
  trustThreeDescription: string
  trustThreeTitle: string
  trustTwoDescription: string
  trustTwoTitle: string
}

export type StorefrontSettings = {
  announcement: string | null
  bankTransferEnabled: boolean
  bankTransferInstructions: string | null
  contactEmail: string | null
  contactPhone: string | null
  copy: StorefrontCopy
  deliveryZones: StorefrontDeliveryZone[]
  deliveryEnabled: boolean
  heroBannerUrl: string | null
  heroSubtitle: string | null
  heroTitle: string
  payOnDeliveryEnabled: boolean
  pickupAddress: string | null
  pickupEnabled: boolean
  primaryColor: string
  seoDescription: string | null
  seoTitle: string | null
  status: StorefrontStatus
}

export type StorefrontAdminProduct = {
  categoryName: string | null
  id: string
  imageUrl: string | null
  isFeatured: boolean
  isPublished: boolean
  name: string
  sellingPrice: number
  status: string
}

export type StorefrontAdminData = {
  businessName: string
  canManage: boolean
  currencyCode: string
  products: StorefrontAdminProduct[]
  settings: StorefrontSettings
  slug: string
}

export type StorefrontVariant = {
  attributes: Record<string, string>
  id: string
  imageUrls: string[]
  name: string
  sellingPrice: number
  sku: string | null
  stockQuantity: number
}

export type StorefrontSpecification = {
  name: string
  unit: "" | "cm" | "in" | "m"
  value: string
}

export type StorefrontProduct = {
  availableStock: number | null
  categoryId: string | null
  categoryName: string | null
  description: string | null
  discountPrice: number | null
  id: string
  imageUrls: string[]
  isFeatured: boolean
  name: string
  sellingPrice: number
  specifications: StorefrontSpecification[]
  trackInventory: boolean
  variants: StorefrontVariant[]
}

export type PublicStorefront = {
  businessId: string
  businessName: string
  currencyCode: string
  logoUrl: string | null
  products: StorefrontProduct[]
  settings: StorefrontSettings
  slug: string
}

export type StorefrontCheckoutResult = {
  bankTransferInstructions: string | null
  currencyCode: string
  orderId: string
  orderNumber: string
  paymentMethod: string
  totalAmount: number
}

export type StorefrontBannerUpload = {
  path: string
  token: string
}

export type StorefrontBannerResult = {
  bannerUrl: string | null
}
