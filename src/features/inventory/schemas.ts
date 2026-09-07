import { z } from "zod"

const inventoryQuantity = z.number().finite()
  .int("Stock quantity must be a whole number.")
  .min(0, "Stock quantity cannot be negative.")
  .max(999_999_999, "Stock quantity is too large.")

export const inventoryOperationSchema = z.object({
  note: z.string().trim().max(500, "Notes must be 500 characters or fewer.").nullable(),
  operation: z.enum(["add", "remove", "adjust", "damage", "return", "loss"]),
  productId: z.uuid(),
  quantity: inventoryQuantity,
  variantId: z.uuid().nullable(),
}).superRefine((input, context) => {
  if (input.operation !== "adjust" && input.quantity === 0) {
    context.addIssue({
      code: "custom",
      message: "Stock quantity must be greater than zero.",
      path: ["quantity"],
    })
  }
})

export type InventoryOperationInput = z.infer<typeof inventoryOperationSchema>
