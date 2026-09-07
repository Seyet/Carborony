import { paymentStatusSchema } from "@/features/payments/checkout-schemas"
import { reconcileStorefrontPayment } from "@/features/payments/server/storefront-payments"
import { ApiError, handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request, paymentStatusSchema, async ({ reference, slug }) => {
    const data = await reconcileStorefrontPayment(reference, slug)
    if (!data) throw new ApiError(404, "PAYMENT_NOT_FOUND", "This payment could not be found.")
    return { data }
  })
}
