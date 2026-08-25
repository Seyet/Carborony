import "server-only"

import { revalidatePath } from "next/cache"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import type { CreateExpenseData } from "../api-types"
import type { CreateExpenseInput } from "../schemas"
import {
  isExpectedExpenseAttachmentPath,
  removeUnreferencedExpenseAttachment,
  verifyExpenseAttachmentUpload,
} from "./manage-attachment"

const safeDatabaseMessages = new Set([
  "Choose a PDF, JPEG, PNG, or WebP attachment.",
  "Complete all attachment details or remove the attachment.",
  "Expense amount must be greater than zero.",
  "Expense date cannot be in the future.",
  "Expense date must be on or after January 1, 1900.",
  "Expense description must be 2,000 characters or fewer.",
  "Expense name must be between 2 and 120 characters.",
  "Select a valid expense category.",
  "Select a valid expense date.",
  "Select a valid payment method.",
  "Select a valid staff member.",
  "The attachment file name is invalid.",
  "The attachment file size must be between 1 byte and 10 MB.",
  "The attachment path is invalid.",
  "This expense could not be found.",
])

function isSetupError(code: string) {
  return ["PGRST202", "PGRST204", "PGRST205"].includes(code)
}

export async function createExpense(
  input: CreateExpenseInput,
): Promise<JsonHandlerResult<CreateExpenseData>> {
  const user = await getCurrentUser()
  if (!user) {
    throw new ApiError(401, "AUTH_REQUIRED", "Sign in to record expenses.")
  }

  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const expenseId = input.attachment?.expenseId ?? crypto.randomUUID()
  const cleanupCandidate = input.attachment
    && isExpectedExpenseAttachmentPath(business.id, input.attachment)
    ? {
        businessId: business.id,
        expenseId,
        storagePath: input.attachment.storagePath,
        supabase,
      }
    : null
  let expenseWasPersisted = false

  try {
    if (input.attachment) {
      await verifyExpenseAttachmentUpload(
        supabase,
        business.id,
        input.attachment,
      )
    }

    const { data, error } = await supabase.rpc("record_business_expense", {
      attachment_file_name: input.attachment?.fileName ?? null,
      attachment_file_size: input.attachment?.fileSize ?? null,
      attachment_mime_type: input.attachment?.mimeType ?? null,
      attachment_storage_path: input.attachment?.storagePath ?? null,
      expense_amount: input.amount,
      expense_category_id: input.categoryId,
      expense_date: input.date,
      expense_description: input.description,
      expense_name: input.name,
      expense_payment_method: input.paymentMethod,
      expense_staff_member_id: input.staffMemberId,
      target_business_id: business.id,
      target_expense_id: expenseId,
    }).single()

    if (error) {
      console.error("Expense creation failed", {
        code: error.code,
        details: error.details,
        message: error.message,
      })

      if (
        error.code === "23505"
        || error.message === "This expense has already been recorded."
      ) {
        throw new ApiError(
          409,
          "EXPENSE_ALREADY_RECORDED",
          "This expense has already been recorded.",
        )
      }
      if (safeDatabaseMessages.has(error.message)) {
        throw new ApiError(422, "EXPENSE_INVALID", error.message)
      }
      if (["23503", "23514"].includes(error.code)) {
        throw new ApiError(
          422,
          "EXPENSE_INVALID",
          "Check the expense details and try again.",
        )
      }
      if (error.code === "42501") {
        throw new ApiError(
          403,
          "EXPENSE_FORBIDDEN",
          "You do not have permission to manage expenses.",
        )
      }
      if (isSetupError(error.code)) {
        throw new ApiError(
          503,
          "EXPENSES_SETUP_REQUIRED",
          "Apply the expense management migration first.",
        )
      }
      throw new ApiError(
        503,
        "EXPENSE_CREATE_FAILED",
        "We couldn't record this expense. Please try again.",
      )
    }
    if (!data || data.expense_id !== expenseId) {
      throw new ApiError(
        503,
        "EXPENSE_CREATE_FAILED",
        "We couldn't record this expense. Please try again.",
      )
    }

    expenseWasPersisted = true
  } catch (error) {
    if (cleanupCandidate && !expenseWasPersisted) {
      await removeUnreferencedExpenseAttachment(cleanupCandidate)
    }
    throw error
  }

  revalidatePath("/app/expenses")
  revalidatePath("/app/dashboard")
  revalidatePath("/app/reports")

  return {
    data: { expenseId },
    message: "Expense recorded successfully.",
    status: 201,
  }
}
