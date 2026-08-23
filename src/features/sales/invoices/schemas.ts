import { z } from "zod"

export const invoicePaymentMethods = [
  "cash",
  "bank_transfer",
  "pos",
  "card",
  "other",
] as const

export const markInvoicePaidSchema = z.object({
  paymentMethod: z.enum(invoicePaymentMethods, {
    error: "Select a valid payment method.",
  }),
})

export type InvoicePaymentMethod = (typeof invoicePaymentMethods)[number]
export type MarkInvoicePaidInput = z.output<typeof markInvoicePaidSchema>
