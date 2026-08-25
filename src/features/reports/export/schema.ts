import { z } from "zod"

const reportDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, "Enter a valid date.")

const optionalUuid = z.union([z.uuid(), z.literal("")]).optional()
  .transform((value) => value || undefined)

const optionalPaymentMethod = z.union([
  z.enum(["cash", "bank_transfer", "pos", "card", "other"]),
  z.literal(""),
]).optional().transform((value) => value || undefined)

const reportViews = [
  "current-stock",
  "stock-movement",
  "stock-valuation",
  "category",
  "date",
] as const

export const reportExportQuerySchema = z.object({
  categoryId: optionalUuid,
  endDate: reportDate,
  format: z.enum(["pdf", "csv", "excel"]),
  paymentMethod: optionalPaymentMethod,
  productId: optionalUuid,
  report: z.enum(["sales", "inventory", "expenses", "profit"]),
  staffId: optionalUuid,
  startDate: reportDate,
  view: z.enum(reportViews).optional(),
}).superRefine((input, context) => {
  if (input.startDate > input.endDate) {
    context.addIssue({
      code: "custom",
      message: "End date must be on or after the start date.",
      path: ["endDate"],
    })
  }

  if (
    input.report === "inventory"
    && input.view !== undefined
    && !["current-stock", "stock-movement", "stock-valuation"].includes(input.view)
  ) {
    context.addIssue({
      code: "custom",
      message: "Select a valid inventory report.",
      path: ["view"],
    })
  }

  if (
    input.report === "expenses"
    && input.view !== undefined
    && !["category", "date"].includes(input.view)
  ) {
    context.addIssue({
      code: "custom",
      message: "Select a valid expense report.",
      path: ["view"],
    })
  }

  if (["sales", "profit"].includes(input.report) && input.view !== undefined) {
    context.addIssue({
      code: "custom",
      message: "This report does not support a view option.",
      path: ["view"],
    })
  }
})

export type ReportExportQuery = z.output<typeof reportExportQuerySchema>
