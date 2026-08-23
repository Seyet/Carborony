import { z } from "zod"

const money = z.number().finite()
  .min(0, "Amount cannot be negative.")
  .max(999_999_999_999, "Amount is too large.")
  .refine((value) => Number.isInteger(value * 10_000), "Use no more than 4 decimal places.")

const quantity = z.number().finite()
  .min(0, "Stock cannot be negative.")
  .max(999_999_999, "Stock quantity is too large.")
  .refine((value) => Number.isInteger(value * 1000), "Use no more than 3 decimal places.")

const nullableText = (maximum: number, message: string) =>
  z.string().trim().max(maximum, message).nullable()

const variantAttributeSchema = z.object({
  name: z.string().trim().min(1, "Enter an option name.").max(50),
  value: z.string().trim().min(1, "Enter an option value.").max(80),
})

export const productVariantSchema = z.object({
  attributes: z.array(variantAttributeSchema).max(10),
  costPrice: money,
  id: z.uuid(),
  isActive: z.boolean(),
  lowStockThreshold: quantity,
  name: z.string().trim().min(1, "Enter the variant name.").max(120),
  sellingPrice: money,
  sku: nullableText(80, "SKU must be 80 characters or fewer."),
  stockQuantity: quantity,
})

export const catalogueProductSchema = z.object({
  categoryId: z.uuid().nullable(),
  costPrice: money,
  description: nullableText(5_000, "Description must be 5,000 characters or fewer."),
  discountPrice: money.nullable(),
  lowStockThreshold: quantity,
  name: z.string().trim().min(2, "Product name must be at least 2 characters.").max(160),
  sellingPrice: money,
  sku: nullableText(80, "SKU must be 80 characters or fewer."),
  status: z.enum(["draft", "active", "archived"]),
  stockQuantity: quantity,
  tags: z.array(z.string().trim().min(1).max(50)).max(30),
  trackInventory: z.boolean(),
  variants: z.array(productVariantSchema).max(100),
}).superRefine((product, context) => {
  if (product.discountPrice !== null && product.discountPrice > product.sellingPrice) {
    context.addIssue({
      code: "custom",
      message: "Discount price cannot exceed the selling price.",
      path: ["discountPrice"],
    })
  }

  const variantSkus = new Set<string>()
  product.variants.forEach((variant, index) => {
    if (!variant.sku) return
    const normalizedSku = variant.sku.toLowerCase()
    if (variantSkus.has(normalizedSku)) {
      context.addIssue({
        code: "custom",
        message: "Variant SKUs must be unique.",
        path: ["variants", index, "sku"],
      })
    }
    variantSkus.add(normalizedSku)
  })

  if (product.variants.length) {
    const variantStock = product.variants.reduce(
      (total, variant) => total + variant.stockQuantity,
      0,
    )
    if (Math.abs(product.stockQuantity - variantStock) > 0.0001) {
      context.addIssue({
        code: "custom",
        message: "Product stock must equal the total stock across its variants.",
        path: ["stockQuantity"],
      })
    }
  }
})

const categoryFields = {
  description: nullableText(500, "Description must be 500 characters or fewer."),
  name: z.string().trim().min(2, "Category name must be at least 2 characters.").max(100),
  parentId: z.uuid().nullable(),
}

export const categoryMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), ...categoryFields }),
  z.object({
    action: z.literal("update"),
    categoryId: z.uuid(),
    isActive: z.boolean(),
    ...categoryFields,
  }),
  z.object({ action: z.literal("delete"), categoryId: z.uuid() }),
  z.object({
    action: z.literal("reorder"),
    orderedIds: z.array(z.uuid()).min(1).max(500),
  }),
])

const imageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const
const videoMimeTypes = ["video/mp4", "video/webm", "video/quicktime"] as const

export const mediaUploadRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    fileName: z.string().trim().min(1).max(255),
    fileSize: z.number().int().positive().max(5 * 1024 * 1024),
    kind: z.literal("image"),
    mimeType: z.enum(imageMimeTypes),
  }),
  z.object({
    fileName: z.string().trim().min(1).max(255),
    fileSize: z.number().int().positive().max(25 * 1024 * 1024),
    kind: z.literal("video"),
    mimeType: z.enum(videoMimeTypes),
  }),
])

const mediaFinalizeFields = {
  fileName: z.string().trim().min(1).max(255),
  position: z.number().int().min(0).max(1_000),
  storagePath: z.string().trim().min(1).max(1_024),
  variantId: z.uuid().nullable(),
}

export const mediaFinalizeSchema = z.discriminatedUnion("kind", [
  z.object({
    ...mediaFinalizeFields,
    fileSize: z.number().int().positive().max(5 * 1024 * 1024),
    kind: z.literal("image"),
    mimeType: z.enum(imageMimeTypes),
  }),
  z.object({
    ...mediaFinalizeFields,
    fileSize: z.number().int().positive().max(25 * 1024 * 1024),
    kind: z.literal("video"),
    mimeType: z.enum(videoMimeTypes),
    variantId: z.null(),
  }),
])

export const mediaUploadBatchSchema = z.object({
  files: z.array(mediaUploadRequestSchema).min(1).max(115),
})

export const mediaFinalizeBatchSchema = z.object({
  items: z.array(mediaFinalizeSchema).min(1).max(115),
}).superRefine((batch, context) => {
  const storagePaths = new Set<string>()
  const variantIds = new Set<string>()

  batch.items.forEach((item, index) => {
    if (storagePaths.has(item.storagePath)) {
      context.addIssue({
        code: "custom",
        message: "Each uploaded media file must be unique.",
        path: ["items", index, "storagePath"],
      })
    }
    storagePaths.add(item.storagePath)

    if (!item.variantId) return
    if (variantIds.has(item.variantId)) {
      context.addIssue({
        code: "custom",
        message: "Each variant can have only one image.",
        path: ["items", index, "variantId"],
      })
    }
    variantIds.add(item.variantId)
  })
})

export const mediaMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete"), mediaId: z.uuid() }),
  z.object({ action: z.literal("primary"), mediaId: z.uuid() }),
  z.object({
    action: z.literal("reorder"),
    orderedIds: z.array(z.uuid()).min(1).max(100),
  }),
])

export type CatalogueProductInput = z.output<typeof catalogueProductSchema>
export type CategoryMutationInput = z.output<typeof categoryMutationSchema>
export type MediaFinalizeInput = z.output<typeof mediaFinalizeSchema>
export type MediaFinalizeBatchInput = z.output<typeof mediaFinalizeBatchSchema>
export type MediaMutationInput = z.output<typeof mediaMutationSchema>
export type MediaUploadBatchInput = z.output<typeof mediaUploadBatchSchema>
export type MediaUploadRequestInput = z.output<typeof mediaUploadRequestSchema>
