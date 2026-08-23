import { z } from "zod"

import { posItemSchema } from "@/features/sales/pos/schemas"

const money = z.number().finite()
  .min(0, "Amount cannot be negative.")
  .max(999_999_999_999, "Amount is too large.")
  .refine((value) => Number.isInteger(value * 10_000), "Use no more than 4 decimal places.")

export const createManualOrderSchema = z.object({
  buyerName: z.string().trim().min(2, "Buyer name must be at least 2 characters.")
    .max(160, "Buyer name must be 160 characters or fewer.").nullable(),
  buyerPhone: z.string().trim().min(7, "Enter a valid buyer phone number.")
    .max(32, "Buyer phone number must be 32 characters or fewer.")
    .regex(/^[0-9+(). -]+$/, "Enter a valid buyer phone number.").nullable(),
  customerId: z.uuid().nullable(),
  deliveryAddress: z.string().trim()
    .min(5, "Delivery address must be at least 5 characters.")
    .max(500, "Delivery address must be 500 characters or fewer."),
  discountAmount: money,
  items: z.array(posItemSchema).min(1, "Add at least one product to the order.").max(100),
  notes: z.string().trim().max(1_000, "Order notes must be 1,000 characters or fewer.").nullable(),
  shippingAmount: money,
})

export const updateOrderStatusSchema = z.object({
  note: z.string().trim().max(500, "Status notes must be 500 characters or fewer.").nullable(),
  status: z.enum(["confirmed", "processing", "ready", "completed", "cancelled", "refunded"]),
})

export type CreateManualOrderInput = z.output<typeof createManualOrderSchema>
export type UpdateOrderStatusInput = z.output<typeof updateOrderStatusSchema>
