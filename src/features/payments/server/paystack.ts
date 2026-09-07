import "server-only"

import { z } from "zod"
import { ApiError } from "@/lib/api/server"

export function paymentEnvironment() {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim()
  const commissionValue = process.env.PAYSTACK_PLATFORM_COMMISSION_PERCENT?.trim() ?? "0"
  const commissionPercent = Number(commissionValue)
  if (!secret || !/^sk_(test|live)_[A-Za-z0-9]+$/.test(secret)
    || !Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100
    || !/^\d{1,3}(?:\.\d{1,2})?$/.test(commissionValue)) {
    throw new ApiError(503, "PAYMENTS_UNAVAILABLE", "Payment setup is not available yet. Please try again later.")
  }
  return { secret, commissionPercent, mode: secret.startsWith("sk_live_") ? "live" as const : "test" as const }
}

export class PaystackRequestError extends ApiError {
  constructor(readonly definitiveRejection: boolean, status: number, code: string, message: string) {
    super(status, code, message)
  }
}

// Do not retry POST requests: a timeout may occur after Paystack creates the account.
async function requestPage(path: string, body?: unknown) {
  const { secret } = paymentEnvironment()
  try {
    const response = await fetch(`https://api.paystack.co${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", Accept: "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    })
    // Bound provider responses while streaming, including responses without Content-Length.
    const reader = response.body?.getReader()
    if (!reader) throw new Error("Missing provider response")
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 2 * 1024 * 1024) {
        await reader.cancel()
        throw new Error("Provider response too large")
      }
      chunks.push(value)
    }
    const payload = z.object({ status: z.boolean(), data: z.unknown().optional(), meta: z.unknown().optional() })
      .parse(JSON.parse(Buffer.concat(chunks).toString("utf8")))
    if (!response.ok || !payload.status) {
      const rejected = !payload.status && [400, 422].includes(response.status)
      throw new PaystackRequestError(rejected, response.status === 429 ? 429 : rejected ? 422 : 502,
        response.status === 429 ? "PAYMENTS_RATE_LIMITED" : "PAYSTACK_REQUEST_FAILED",
        response.status === 429 ? "Too many requests. Please wait and try again."
          : rejected ? "Paystack could not accept these account details. Check them and try again."
          : "We couldn't reach the payment provider. Please try again shortly.")
    }
    return payload
  } catch (error) {
    if (error instanceof PaystackRequestError) throw error
    // Never log raw fetch errors: the bank-resolution URL contains an account number.
    throw new PaystackRequestError(false, 502, "PAYSTACK_UNAVAILABLE", "We couldn't confirm the payment provider's response. Please check setup status before trying again.")
  }
}

export async function paystackRequest(path: string, body?: unknown): Promise<unknown> {
  return (await requestPage(path, body)).data
}

const request = paystackRequest

const bankSchema = z.object({
  code: z.string(), name: z.string(), active: z.boolean(),
  currency: z.string(), country: z.string(),
})
export async function listPaymentBanks() {
  const banks = new Map<string, { code: string; name: string }>()
  const seenCursors = new Set<string>()
  let next: string | undefined
  for (let page = 1; page <= 10; page++) {
    const query = new URLSearchParams({ country: "nigeria", currency: "NGN", perPage: "100", use_cursor: "true" })
    if (next) query.set("next", next)
    const payload = await requestPage(`/bank?${query}`)
    const rows = z.array(bankSchema).parse(payload.data)
    const pagination = z.object({ next: z.string().min(1).nullable() }).safeParse(payload.meta)
    if (!pagination.success) break
    for (const bank of rows) {
      if (bank.active && bank.currency === "NGN" && bank.country === "Nigeria") banks.set(bank.code, { code: bank.code, name: bank.name })
    }
    // Filtered pages can contain fewer than perPage rows even when more banks exist.
    if (pagination.data.next === null) return [...banks.values()].sort((a, b) => a.name.localeCompare(b.name))
    next = pagination.data.next
    if (seenCursors.has(next)) break
    seenCursors.add(next)
  }
  throw new ApiError(502, "BANK_LIST_UNAVAILABLE", "We couldn't load the complete bank list. Please try again later.")
}

export async function resolvePaymentAccount(bankCode: string, accountNumber: string) {
  const bank = (await listPaymentBanks()).find((item) => item.code === bankCode)
  if (!bank) throw new ApiError(422, "BANK_UNAVAILABLE", "Choose an available Nigerian bank.")
  const query = new URLSearchParams({ account_number: accountNumber, bank_code: bankCode })
  const account = z.object({ account_number: z.string(), account_name: z.string().trim().min(1).max(200) })
    .parse(await request(`/bank/resolve?${query}`))
  if (account.account_number !== accountNumber) throw new ApiError(502, "ACCOUNT_MISMATCH", "The bank account could not be verified.")
  return { bankCode, bankName: bank.name, accountNumber, accountName: account.account_name }
}

const subaccountSchema = z.object({
  subaccount_code: z.string().regex(/^ACCT_[A-Za-z0-9]+$/),
  domain: z.enum(["test", "live"]),
  currency: z.literal("NGN"),
  account_number: z.string(),
  percentage_charge: z.coerce.number(),
  active: z.boolean(), is_verified: z.boolean(),
  metadata: z.unknown().optional(),
  description: z.string().nullish(),
})
export type PaystackSubaccount = z.output<typeof subaccountSchema>

export async function createPaymentSubaccount(input: {
  businessName: string; businessId: string; operationId: string
  bankCode: string; accountNumber: string; commissionPercent: number
}) {
  return subaccountSchema.parse(await request("/subaccount", {
    business_name: input.businessName,
    bank_code: input.bankCode,
    account_number: input.accountNumber,
    percentage_charge: input.commissionPercent,
    description: `Carborony setup ${input.operationId}`,
    metadata: JSON.stringify({ carborony_business_id: input.businessId, carborony_operation_id: input.operationId }),
  }))
}

export async function findPaymentSubaccount(operationId: string) {
  // The stable operation marker lets us recover an account after a lost response.
  for (let page = 1; page <= 10; page++) {
    const rows = z.array(z.unknown()).parse(await request(`/subaccount?perPage=100&page=${page}`))
    const matches = rows.filter((row) => typeof row === "object" && row !== null
      && "description" in row && row.description === `Carborony setup ${operationId}`)
    if (matches.length > 1) throw new ApiError(409, "PAYMENT_REVIEW_REQUIRED", "Payment setup needs support review before continuing.")
    if (matches.length === 1) return subaccountSchema.parse(matches[0])
    if (rows.length < 100) return null
  }
  throw new ApiError(409, "PAYMENT_REVIEW_REQUIRED", "We couldn't confirm the setup status. Please contact support before setting up another account.")
}

export async function fetchPaymentSubaccount(code: string) {
  return subaccountSchema.parse(await request(`/subaccount/${encodeURIComponent(code)}`))
}
