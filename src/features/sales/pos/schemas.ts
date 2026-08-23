import { z } from "zod"

const quantity = z.number().finite().positive("Quantity must be greater than zero.")
  .max(10_000, "Quantity is too large.")
  .refine((value) => Number.isInteger(value * 1000), "Use no more than 3 decimal places.")

const unitPrice = z.number().finite()
  .min(0, "Unit price cannot be negative.")
  .max(999_999_999_999, "Unit price is too large.")
  .refine((value) => Number.isInteger(value * 10_000), "Use no more than 4 decimal places.")

const paymentMethod = z.enum(["cash", "bank_transfer", "pos", "card", "other"])

export const posItemSchema = z.discriminatedUnion("source", [
  z.object({
    productId: z.uuid(),
    quantity,
    source: z.literal("catalogue"),
    variantId: z.uuid().nullable(),
  }),
  z.object({
    name: z.string().trim().min(1, "Enter the external product name.")
      .max(160, "Product name must be 160 characters or fewer."),
    quantity,
    sku: z.string().trim().max(80, "SKU must be 80 characters or fewer.").nullable(),
    source: z.literal("external"),
    unitPrice,
  }),
])

const transactionFields = {
  buyerName: z.string().trim().min(2, "Buyer name must be at least 2 characters.")
    .max(160, "Buyer name must be 160 characters or fewer.").nullable(),
  buyerPhone: z.string().trim().min(7, "Enter a valid buyer phone number.")
    .max(32, "Buyer phone number must be 32 characters or fewer.")
    .regex(/^[0-9+(). -]+$/, "Enter a valid buyer phone number.").nullable(),
  customerId: z.uuid().nullable(),
  discountAmount: z.number().finite().min(0, "Discount cannot be negative."),
  items: z.array(posItemSchema).min(1, "Add at least one product to the sale.")
    .max(100, "A transaction can contain at most 100 line items."),
}

export const completeSaleSchema = z.object({
  ...transactionFields,
  paymentMethod,
})

export const createInvoiceSchema = z.object({
  ...transactionFields,
  paymentMethod,
})

export type CompleteSaleInput = z.output<typeof completeSaleSchema>
export type CreateInvoiceInput = z.output<typeof createInvoiceSchema>
export type PosItemInput = CompleteSaleInput["items"][number]
