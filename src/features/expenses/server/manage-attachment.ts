import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import type { PrepareExpenseAttachmentData } from "../api-types"
import type {
  ExpenseAttachmentInput,
  ExpenseAttachmentRequestInput,
} from "../schemas"

export const expenseAttachmentsBucket = "expense-attachments"

type ExpenseSupabaseClient = Awaited<ReturnType<typeof createClient>>

function extensionForMime(mimeType: string) {
  const extensions: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }

  return extensions[mimeType]
}

function attachmentPathParts(
  businessId: string,
  attachment: ExpenseAttachmentInput,
) {
  const prefix = `${businessId}/${attachment.expenseId}/`

  if (!attachment.storagePath.startsWith(prefix)) return null

  const fileName = attachment.storagePath.slice(prefix.length)
  const extension = extensionForMime(attachment.mimeType)

  if (
    !fileName
    || fileName.includes("/")
    || fileName.includes("\\")
    || !extension
    || !fileName.endsWith(`.${extension}`)
  ) {
    return null
  }

  const objectId = fileName.slice(0, -(extension.length + 1))
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(objectId)) {
    return null
  }

  return {
    fileName,
    folder: prefix.slice(0, -1),
  }
}

function normalizedMimeType(value?: string) {
  return value?.split(";", 1)[0]?.trim().toLowerCase()
}

async function requireExpenseOwnerActor() {
  const user = await getCurrentUser()
  if (!user) {
    throw new ApiError(
      401,
      "AUTH_REQUIRED",
      "Sign in to manage expense attachments.",
    )
  }

  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const ownerResult = await supabase.rpc("is_business_creator", {
    target_business_id: business.id,
  })

  if (ownerResult.error) {
    console.error("Expense attachment permission lookup failed", {
      code: ownerResult.error.code,
      message: ownerResult.error.message,
    })
    throw new ApiError(
      503,
      "EXPENSE_ATTACHMENT_UNAVAILABLE",
      "We couldn't prepare this attachment. Please try again.",
    )
  }
  if (!ownerResult.data) {
    throw new ApiError(
      403,
      "EXPENSE_FORBIDDEN",
      "You do not have permission to manage expenses.",
    )
  }

  return { business, supabase, user }
}

export async function prepareExpenseAttachment(
  input: ExpenseAttachmentRequestInput,
): Promise<JsonHandlerResult<PrepareExpenseAttachmentData>> {
  const { business, supabase } = await requireExpenseOwnerActor()
  const extension = extensionForMime(input.mimeType)
  if (!extension) {
    throw new ApiError(
      422,
      "ATTACHMENT_TYPE_INVALID",
      "Choose a PDF, JPEG, PNG, or WebP attachment.",
    )
  }

  const expenseId = crypto.randomUUID()
  const path = `${business.id}/${expenseId}/${crypto.randomUUID()}.${extension}`
  const uploadResult = await supabase.storage
    .from(expenseAttachmentsBucket)
    .createSignedUploadUrl(path)

  if (uploadResult.error || !uploadResult.data) {
    console.error("Expense attachment upload URL creation failed", {
      message: uploadResult.error?.message,
    })
    throw new ApiError(
      503,
      "ATTACHMENT_UPLOAD_UNAVAILABLE",
      "We couldn't prepare this attachment upload. Please try again.",
    )
  }

  return {
    data: {
      expenseId,
      upload: {
        path: uploadResult.data.path,
        token: uploadResult.data.token,
      },
    },
  }
}

export function isExpectedExpenseAttachmentPath(
  businessId: string,
  attachment: ExpenseAttachmentInput,
) {
  return attachmentPathParts(businessId, attachment) !== null
}

export async function verifyExpenseAttachmentUpload(
  supabase: ExpenseSupabaseClient,
  businessId: string,
  attachment: ExpenseAttachmentInput,
) {
  const pathParts = attachmentPathParts(businessId, attachment)
  if (!pathParts) {
    throw new ApiError(
      422,
      "ATTACHMENT_PATH_INVALID",
      "The uploaded attachment path is invalid.",
    )
  }

  const bucket = supabase.storage.from(expenseAttachmentsBucket)
  const [infoResult, listResult] = await Promise.all([
    bucket.info(attachment.storagePath),
    bucket.list(pathParts.folder, { limit: 2 }),
  ])

  if (infoResult.error || listResult.error) {
    console.error("Expense attachment verification failed", {
      infoMessage: infoResult.error?.message,
      listMessage: listResult.error?.message,
    })
    throw new ApiError(
      503,
      "ATTACHMENT_VERIFICATION_FAILED",
      "We couldn't verify this attachment. Please try again.",
    )
  }

  const folderObjects = listResult.data ?? []
  if (
    folderObjects.length !== 1
    || folderObjects[0]?.name !== pathParts.fileName
  ) {
    throw new ApiError(
      422,
      "ATTACHMENT_UPLOAD_INVALID",
      "Upload the attachment before recording the expense.",
    )
  }

  const storedSize = infoResult.data.size
    ?? (typeof infoResult.data.metadata?.size === "number"
      ? infoResult.data.metadata.size
      : undefined)
  const storedMimeType = normalizedMimeType(
    infoResult.data.contentType
      ?? (typeof infoResult.data.metadata?.mimetype === "string"
        ? infoResult.data.metadata.mimetype
        : undefined),
  )

  if (
    (storedSize !== undefined && storedSize !== attachment.fileSize)
    || (storedMimeType !== undefined && storedMimeType !== attachment.mimeType)
  ) {
    throw new ApiError(
      422,
      "ATTACHMENT_METADATA_INVALID",
      "The uploaded attachment does not match the selected file.",
    )
  }
}

export async function removeUnreferencedExpenseAttachment({
  businessId,
  expenseId,
  storagePath,
  supabase,
}: {
  businessId: string
  expenseId: string
  storagePath: string
  supabase: ExpenseSupabaseClient
}) {
  const [idReference, pathReference] = await Promise.all([
    supabase.from("expenses").select("id")
      .eq("business_id", businessId)
      .eq("id", expenseId)
      .limit(1)
      .maybeSingle(),
    supabase.from("expenses").select("id")
      .eq("business_id", businessId)
      .eq("attachment_storage_path", storagePath)
      .limit(1)
      .maybeSingle(),
  ])

  if (idReference.error || pathReference.error) {
    console.error("Expense attachment cleanup reference check failed", {
      idCode: idReference.error?.code,
      pathCode: pathReference.error?.code,
    })
    return
  }
  if (idReference.data || pathReference.data) return

  const removal = await supabase.storage
    .from(expenseAttachmentsBucket)
    .remove([storagePath])

  if (removal.error) {
    console.error("Expense attachment object cleanup failed", {
      message: removal.error.message,
    })
  }
}

export async function getExpenseAttachmentDownload(expenseId: string) {
  const user = await getCurrentUser()
  if (!user) {
    throw new ApiError(
      401,
      "AUTH_REQUIRED",
      "Sign in to download expense attachments.",
    )
  }

  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const expenseResult = await supabase.from("expenses")
    .select("id, attachment_storage_path, attachment_file_name, attachment_mime_type, attachment_file_size")
    .eq("business_id", business.id)
    .eq("id", expenseId)
    .maybeSingle()

  if (expenseResult.error) {
    console.error("Expense attachment lookup failed", {
      code: expenseResult.error.code,
      message: expenseResult.error.message,
    })
    if (["PGRST202", "PGRST204", "PGRST205"].includes(expenseResult.error.code)) {
      throw new ApiError(
        503,
        "EXPENSES_SETUP_REQUIRED",
        "Apply the expense management migration first.",
      )
    }
    throw new ApiError(
      503,
      "ATTACHMENT_DOWNLOAD_FAILED",
      "We couldn't load this expense attachment. Please try again.",
    )
  }
  if (!expenseResult.data) {
    throw new ApiError(
      404,
      "EXPENSE_NOT_FOUND",
      "This expense could not be found.",
    )
  }

  const expense = expenseResult.data
  if (
    !expense.attachment_storage_path
    || !expense.attachment_file_name
    || !expense.attachment_mime_type
    || !expense.attachment_file_size
  ) {
    throw new ApiError(
      404,
      "ATTACHMENT_NOT_FOUND",
      "This expense does not have an attachment.",
    )
  }

  const pathParts = attachmentPathParts(business.id, {
    expenseId,
    fileName: expense.attachment_file_name,
    fileSize: expense.attachment_file_size,
    mimeType: expense.attachment_mime_type as ExpenseAttachmentInput["mimeType"],
    storagePath: expense.attachment_storage_path,
  })
  if (!pathParts) {
    console.error("Stored expense attachment path is invalid", { expenseId })
    throw new ApiError(
      503,
      "ATTACHMENT_DOWNLOAD_FAILED",
      "We couldn't load this expense attachment. Please try again.",
    )
  }

  const downloadResult = await supabase.storage
    .from(expenseAttachmentsBucket)
    .download(expense.attachment_storage_path)

  if (downloadResult.error || !downloadResult.data) {
    console.error("Expense attachment object download failed", {
      expenseId,
      message: downloadResult.error?.message,
    })
    throw new ApiError(
      503,
      "ATTACHMENT_DOWNLOAD_FAILED",
      "We couldn't download this attachment. Please try again.",
    )
  }

  return {
    body: downloadResult.data,
    fileName: expense.attachment_file_name,
    fileSize: expense.attachment_file_size,
    mimeType: expense.attachment_mime_type,
  }
}
