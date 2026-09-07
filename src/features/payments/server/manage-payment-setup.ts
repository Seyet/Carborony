import "server-only"

import { randomUUID } from "node:crypto"
import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { getCurrentUser } from "@/lib/auth/session"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSupabaseAdminEnvironment } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"
import type { PaymentSetupInput } from "../schemas"
import type { PaymentAccount, PaymentSetupData, PaymentBank, VerifiedPaymentAccount } from "../types"
import {
  createPaymentSubaccount, fetchPaymentSubaccount, findPaymentSubaccount,
  listPaymentBanks, paymentEnvironment, PaystackRequestError,
  resolvePaymentAccount, type PaystackSubaccount,
} from "./paystack"

type AccountRow = Database["public"]["Tables"]["business_payment_accounts"]["Row"]

function accountView(row: AccountRow | null): PaymentAccount | null {
  return row ? {
    accountName: row.account_name, accountLastFour: row.account_last_four,
    bankName: row.bank_name, commissionPercent: Number(row.commission_percent), status: row.status,
    providerActive: row.provider_active, providerVerified: row.provider_verified,
  } : null
}

function databaseError(error: { code?: string }) {
  const missing = ["42P01", "PGRST204", "PGRST205"].includes(error.code ?? "")
  console.error("Payment setup database request failed", { code: error.code })
  return new ApiError(503, missing ? "PAYMENTS_SETUP_REQUIRED" : "PAYMENT_SAVE_FAILED",
    missing ? "Payment setup is not available yet. Please contact support."
      : "We couldn't save the payment setup. Check its status before trying again.")
}

async function ownerContext() {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to manage payments.")
  const business = await getCurrentBusiness()
  if (business.roleCode !== "owner") throw new ApiError(403, "PAYMENTS_OWNER_REQUIRED", "Only the business owner can manage payout accounts.")
  const supabase = await createClient()
  const result = await supabase.from("businesses").select("created_by, country_code, currency_code")
    .eq("id", business.id).single()
  if (result.error) throw databaseError(result.error)
  if (result.data.created_by !== user.id) throw new ApiError(403, "PAYMENTS_OWNER_REQUIRED", "Only the business owner can manage payout accounts.")
  return { user, business, supabase, supported: result.data.country_code === "NG" && result.data.currency_code === "NGN" }
}

async function readAccount(context: Awaited<ReturnType<typeof ownerContext>>, mode: "test" | "live") {
  const result = await context.supabase.from("business_payment_accounts").select("*")
    .eq("business_id", context.business.id).eq("provider", "paystack").eq("provider_mode", mode).maybeSingle()
  if (result.error) throw databaseError(result.error)
  return result.data
}

async function persistProviderAccount(row: AccountRow, provider: PaystackSubaccount) {
  if (provider.domain !== row.provider_mode || provider.account_number.slice(-4) !== row.account_last_four
    || provider.percentage_charge !== Number(row.commission_percent)
    || (row.subaccount_code && row.subaccount_code !== provider.subaccount_code)) {
    throw new ApiError(409, "PAYMENT_REVIEW_REQUIRED", "The payment account needs support review before continuing.")
  }
  const result = await createAdminClient().from("business_payment_accounts").update({
    status: "connected", subaccount_code: provider.subaccount_code,
    provider_active: provider.active, provider_verified: provider.is_verified,
  }).eq("id", row.id).eq("operation_id", row.operation_id).select("*").single()
  if (result.error) throw databaseError(result.error)
  return result.data
}

export async function managePaymentSetup(input: PaymentSetupInput): Promise<JsonHandlerResult<
  PaymentSetupData | { banks: PaymentBank[] } | VerifiedPaymentAccount
>> {
  const context = await ownerContext()
  let environment: ReturnType<typeof paymentEnvironment>
  try {
    environment = paymentEnvironment()
    getSupabaseAdminEnvironment()
  } catch {
    if (input.action !== "status") throw new ApiError(503, "PAYMENTS_UNAVAILABLE", "Payment setup is not available yet. Please try again later.")
    return { data: { account: null, available: false, supported: context.supported, mode: null, commissionPercent: 0 } }
  }
  const { mode, commissionPercent } = environment
  const saved = await readAccount(context, mode)
  const response = (row: AccountRow | null): PaymentSetupData => ({
    account: accountView(row), available: true, supported: context.supported, mode, commissionPercent,
  })
  if (input.action === "status") return { data: response(saved) }
  if (!context.supported) throw new ApiError(422, "PAYMENTS_REGION_UNSUPPORTED", "Payment setup currently supports Nigerian businesses using NGN.")
  if (input.action === "banks") return { data: { banks: await listPaymentBanks() } }
  if (input.action === "resolve") return { data: await resolvePaymentAccount(input.bankCode, input.accountNumber) }

  // Any prior attempt must be recovered, never blindly recreated after a timeout.
  if (saved) {
    if (saved.status === "connected" && input.action === "create") return { data: response(saved), message: "A payout account is already saved for this business." }
    const provider = saved.subaccount_code
      ? await fetchPaymentSubaccount(saved.subaccount_code)
      : await findPaymentSubaccount(saved.operation_id)
    if (!provider) return { data: response(saved), message: "Setup is still awaiting confirmation. Check again shortly; if it remains pending, contact support." }
    return { data: response(await persistProviderAccount(saved, provider)), message: "Payment account status updated." }
  }
  if (input.action === "refresh") return { data: response(null) }
  if (input.commissionPercent !== commissionPercent) throw new ApiError(409, "COMMISSION_CHANGED", "The platform fee changed. Reload payment settings and confirm the updated fee.")

  // Re-resolve server-side so the confirmed name cannot be substituted in the browser.
  const verified = await resolvePaymentAccount(input.bankCode, input.accountNumber)
  if (verified.accountName !== input.accountName) throw new ApiError(409, "ACCOUNT_NAME_CHANGED", "Verify the bank account again before confirming.")
  const admin = createAdminClient()
  const operationId = randomUUID()
  const reserved = await admin.from("business_payment_accounts").insert({
    business_id: context.business.id, provider_mode: mode, operation_id: operationId,
    bank_code: verified.bankCode, bank_name: verified.bankName, account_name: verified.accountName,
    account_last_four: verified.accountNumber.slice(-4), commission_percent: commissionPercent,
    created_by: context.user.id,
  }).select("*").single()
  if (reserved.error) {
    if (reserved.error.code === "23505") throw new ApiError(409, "PAYMENT_SETUP_IN_PROGRESS", "Payment setup has already started. Check its status.")
    throw databaseError(reserved.error)
  }
  const row = reserved.data
  try {
    const provider = await createPaymentSubaccount({
      businessName: context.business.name, businessId: context.business.id, operationId,
      bankCode: verified.bankCode, accountNumber: verified.accountNumber, commissionPercent,
    })
    if (provider.account_number !== verified.accountNumber) {
      throw new ApiError(409, "PAYMENT_REVIEW_REQUIRED", "The payment account needs support review before continuing.")
    }
    return { data: response(await persistProviderAccount(row, provider)), message: "Your payout account has been saved." }
  } catch (error) {
    const rejected = error instanceof PaystackRequestError && error.definitiveRejection
    const result = rejected
      ? await admin.from("business_payment_accounts").delete().eq("id", row.id).eq("operation_id", operationId).eq("status", "creating")
      : await admin.from("business_payment_accounts").update({ status: "reconciliation_required" })
          .eq("id", row.id).eq("operation_id", operationId).eq("status", "creating")
    if (result.error) console.error("Payment setup recovery state failed", { code: result.error.code })
    if (rejected) throw error
    // Even a malformed success response can mean the account was created remotely.
    return {
      data: response({ ...row, status: "reconciliation_required" }),
      message: "We couldn't confirm setup yet. Check its status to safely continue.",
      status: 202,
    }
  }
}
