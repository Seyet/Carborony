import { z } from "zod"

const nullableText = (maximum: number) => z.string().trim().max(maximum).nullable()
const deliveryZoneSchema = z.object({
  coverageDetails: nullableText(300),
  deliveryFee: z.number().finite().nonnegative().max(1_000_000_000),
  id: z.uuid(),
  isActive: z.boolean(),
  name: z.string().trim().min(2, "Enter a zone name.").max(80),
  position: z.number().int().nonnegative(),
})
const requiredCopy = (label: string, maximum: number) => z.string().trim()
  .min(1, `${label} is required.`)
  .max(maximum, `${label} must be ${maximum} characters or fewer.`)

export const storefrontSettingsSchema = z.object({
  announcement: nullableText(160),
  bankTransferEnabled: z.boolean(),
  bankTransferInstructions: nullableText(1000),
  contactEmail: z.union([z.email("Enter a valid contact email."), z.literal("")]).nullable(),
  contactPhone: nullableText(32),
  copy: z.object({
    catalogueDescription: requiredCopy("Catalogue description", 160),
    catalogueEyebrow: requiredCopy("Catalogue label", 60),
    catalogueTitle: requiredCopy("Catalogue title", 80).min(2),
    footerTagline: requiredCopy("Footer tagline", 240).min(2),
    heroCtaLabel: requiredCopy("Hero button label", 40),
    heroEyebrow: requiredCopy("Hero label", 80),
    trustOneDescription: requiredCopy("First reassurance description", 100).min(2),
    trustOneTitle: requiredCopy("First reassurance title", 50),
    trustThreeDescription: requiredCopy("Third reassurance description", 100).min(2),
    trustThreeTitle: requiredCopy("Third reassurance title", 50),
    trustTwoDescription: requiredCopy("Second reassurance description", 100).min(2),
    trustTwoTitle: requiredCopy("Second reassurance title", 50),
  }),
  deliveryZones: z.array(deliveryZoneSchema).max(100),
  deliveryEnabled: z.boolean(),
  featuredProductIds: z.array(z.uuid()).max(1000),
  heroSubtitle: nullableText(240),
  heroTitle: z.string().trim().min(2).max(100),
  payOnDeliveryEnabled: z.boolean(),
  pickupAddress: nullableText(500),
  pickupEnabled: z.boolean(),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i, "Choose a valid colour."),
  publishedProductIds: z.array(z.uuid()).max(1000),
  requestedStatus: z.enum(["draft", "published", "paused"]),
  seoDescription: nullableText(170),
  seoTitle: nullableText(70),
}).superRefine((value, context) => {
  if (!value.deliveryEnabled && !value.pickupEnabled) {
    context.addIssue({ code: "custom", message: "Enable delivery or pickup.", path: ["deliveryEnabled"] })
  }
  if (value.deliveryEnabled && !value.deliveryZones.some((zone) => zone.isActive)) {
    context.addIssue({ code: "custom", message: "Add at least one active delivery zone.", path: ["deliveryZones"] })
  }
  const zoneNames = value.deliveryZones.map((zone) => zone.name.trim().toLocaleLowerCase())
  if (new Set(zoneNames).size !== zoneNames.length) {
    context.addIssue({ code: "custom", message: "Delivery zone names must be unique.", path: ["deliveryZones"] })
  }
  if (!value.payOnDeliveryEnabled && !value.bankTransferEnabled) {
    context.addIssue({ code: "custom", message: "Enable at least one payment method.", path: ["payOnDeliveryEnabled"] })
  }
  if (value.pickupEnabled && !value.pickupAddress) {
    context.addIssue({ code: "custom", message: "Enter the pickup address.", path: ["pickupAddress"] })
  }
  if (value.bankTransferEnabled && !value.bankTransferInstructions) {
    context.addIssue({ code: "custom", message: "Enter bank transfer instructions.", path: ["bankTransferInstructions"] })
  }
  if (value.requestedStatus === "published" && !value.publishedProductIds.length) {
    context.addIssue({ code: "custom", message: "Publish at least one active product.", path: ["publishedProductIds"] })
  }
  const published = new Set(value.publishedProductIds)
  if (value.featuredProductIds.some((id) => !published.has(id))) {
    context.addIssue({ code: "custom", message: "Featured products must be published.", path: ["featuredProductIds"] })
  }
})

export const storefrontCheckoutSchema = z.object({
  buyerEmail: z.email("Enter a valid email address.").max(254),
  buyerName: z.string().trim().min(2).max(120),
  buyerPhone: z.string().trim().min(7).max(32).regex(/^[0-9+(). -]+$/, "Enter a valid phone number."),
  deliveryAddress: z.string().trim().max(500).nullable(),
  deliveryMethod: z.enum(["delivery", "pickup"]),
  deliveryZoneId: z.uuid().nullable(),
  idempotencyKey: z.uuid(),
  items: z.array(z.object({
    productId: z.uuid(),
    quantity: z.number().finite().positive().max(10_000),
    variantId: z.uuid().nullable(),
  })).min(1, "Your cart is empty.").max(100),
  notes: z.string().trim().max(500).nullable(),
  paymentMethod: z.enum(["pay_on_delivery", "bank_transfer"]),
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
}).superRefine((value, context) => {
  if (value.deliveryMethod === "delivery" && (!value.deliveryAddress || value.deliveryAddress.length < 5)) {
    context.addIssue({ code: "custom", message: "Enter a delivery address.", path: ["deliveryAddress"] })
  }
  if (value.deliveryMethod === "delivery" && !value.deliveryZoneId) {
    context.addIssue({ code: "custom", message: "Select a delivery zone.", path: ["deliveryZoneId"] })
  }
  if (value.deliveryMethod === "pickup" && value.deliveryZoneId) {
    context.addIssue({ code: "custom", message: "Pickup does not use a delivery zone.", path: ["deliveryZoneId"] })
  }
})

const storefrontBannerFileSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(5 * 1024 * 1024),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
})

export const storefrontBannerRequestSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("prepare"), payload: storefrontBannerFileSchema }),
  z.object({ operation: z.literal("finalize"), payload: z.object({ storagePath: z.string().trim().min(1).max(512) }) }),
  z.object({ operation: z.literal("remove"), payload: z.object({}) }),
])

export type StorefrontSettingsInput = z.output<typeof storefrontSettingsSchema>
export type StorefrontCheckoutInput = z.output<typeof storefrontCheckoutSchema>
export type StorefrontBannerRequestSchemaInput = z.output<typeof storefrontBannerRequestSchema>
