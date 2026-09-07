import { paymentSetupSchema } from "@/features/payments/schemas"
import { managePaymentSetup } from "@/features/payments/server/manage-payment-setup"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request, paymentSetupSchema, managePaymentSetup)
}
