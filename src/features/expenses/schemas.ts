import { z } from "zod"

import { expensePaymentMethods } from "./types"

export const expenseAttachmentMaxBytes = 10 * 1024 * 1024
export const expenseAttachmentMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

const attachmentFileName = z.string().trim()
  .min(1, "Choose an attachment.")
  .max(255, "Attachment file name must be 255 characters or fewer.")
  .refine(
    (value) => !/[\\/\u0000-\u001f\u007f]/.test(value),
    "The attachment file name is invalid.",
  )

const attachmentFields = {
  fileName: attachmentFileName,
  fileSize: z.number().int().positive("The attachment is empty.")
    .max(expenseAttachmentMaxBytes, "Attachment must be 10 MB or smaller."),
  mimeType: z.enum(expenseAttachmentMimeTypes, {
    error: "Choose a PDF, JPEG, PNG, or WebP attachment.",
  }),
}

export const expenseAttachmentRequestSchema = z.object(attachmentFields)

export const expenseAttachmentSchema = z.object({
  ...attachmentFields,
  expenseId: z.uuid(),
  storagePath: z.string().trim().min(1).max(1_024),
})

const money = z.number().finite()
  .positive("Expense amount must be greater than zero.")
  .max(999_999_999_999, "Expense amount is too large.")
  .refine(
    (value) => Number.isInteger(value * 10_000),
    "Use no more than 4 decimal places.",
  )

const expenseDate = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid expense date.")
  .refine((value) => {
    const parsedDate = new Date(`${value}T00:00:00Z`)

    return !Number.isNaN(parsedDate.getTime())
      && parsedDate.toISOString().slice(0, 10) === value
  }, "Enter a valid expense date.")
  .refine(
    (value) => value >= "1900-01-01",
    "Expense date must be on or after January 1, 1900.",
  )

export const createExpenseSchema = z.object({
  amount: money,
  attachment: expenseAttachmentSchema.nullable(),
  categoryId: z.uuid({ error: "Select a valid expense category." }),
  date: expenseDate,
  description: z.string().trim()
    .max(2_000, "Expense description must be 2,000 characters or fewer.")
    .nullable()
    .transform((value) => value || null),
  name: z.string().trim()
    .min(2, "Expense name must be at least 2 characters.")
    .max(120, "Expense name must be 120 characters or fewer."),
  paymentMethod: z.enum(expensePaymentMethods, {
    error: "Select a valid payment method.",
  }),
  staffMemberId: z.uuid({ error: "Select a valid staff member." }).nullable(),
})

export type CreateExpenseInput = z.output<typeof createExpenseSchema>
export type ExpenseAttachmentInput = z.output<typeof expenseAttachmentSchema>
export type ExpenseAttachmentRequestInput = z.output<
  typeof expenseAttachmentRequestSchema
>
