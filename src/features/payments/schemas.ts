import { z } from "zod"

const bankAccount = {
  bankCode: z.string().trim().regex(/^\d{3,12}$/, "Choose a bank."),
  accountNumber: z.string().trim().regex(/^\d{10}$/, "Enter a 10-digit account number."),
}

export const paymentSetupSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status") }),
  z.object({ action: z.literal("banks") }),
  z.object({ action: z.literal("refresh") }),
  z.object({ action: z.literal("resolve"), ...bankAccount }),
  z.object({
    action: z.literal("create"),
    ...bankAccount,
    accountName: z.string().trim().min(1).max(200),
    commissionPercent: z.number().min(0).max(100),
    confirmed: z.literal(true),
  }),
])

export type PaymentSetupInput = z.output<typeof paymentSetupSchema>
