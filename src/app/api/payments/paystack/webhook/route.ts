import { handlePaystackWebhook } from "@/features/payments/server/paystack-webhook"

export const runtime = "nodejs"
export const POST = handlePaystackWebhook
