import { z } from "zod"

export const instagramConnectSchema = z.object({}).strict()
export const instagramSyncSchema = z.object({}).strict()
export const instagramDisconnectSchema = z.object({}).strict()

const optionalDecimal = z.string().trim().max(32).refine(
  (value) => value === "" || /^\d+(?:\.\d{1,4})?$/.test(value),
  "Enter a valid non-negative amount.",
)
const optionalQuantity = z.string().trim().max(32).refine(
  (value) => value === "" || /^\d+(?:\.\d{1,3})?$/.test(value),
  "Enter a valid non-negative quantity.",
)

export const instagramEditedDraftSchema = z.object({
  brand: z.string().trim().max(120),
  categoryId: z.union([z.literal(""), z.uuid()]),
  colours: z.string().trim().max(2_400),
  description: z.string().trim().max(5_000),
  discountPrice: optionalDecimal,
  name: z.string().trim().max(160),
  sellingPrice: optionalDecimal,
  sizes: z.string().trim().max(2_400),
  sku: z.string().trim().max(80),
  stockQuantity: optionalQuantity,
  tags: z.string().trim().max(1_500),
}).strict().superRefine((draft, context) => {
  const discountPrice = draft.discountPrice ? Number(draft.discountPrice) : null
  const sellingPrice = draft.sellingPrice ? Number(draft.sellingPrice) : null
  if (discountPrice !== null && sellingPrice !== null && discountPrice > sellingPrice) {
    context.addIssue({
      code: "custom",
      message: "Discount price cannot exceed the selling price.",
      path: ["discountPrice"],
    })
  }
})

export const instagramImportMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    draft: instagramEditedDraftSchema,
  }).strict(),
  z.object({
    action: z.literal("approve"),
    confirmCreateNew: z.boolean().default(false),
    draft: instagramEditedDraftSchema.optional(),
    publish: z.boolean().default(false),
  }).strict(),
  z.object({
    action: z.literal("attach"),
    productId: z.uuid(),
  }).strict(),
  z.object({ action: z.literal("discard") }).strict(),
])

export type InstagramEditedDraftInput = z.output<typeof instagramEditedDraftSchema>
export type InstagramImportMutationInput = z.output<typeof instagramImportMutationSchema>
