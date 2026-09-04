import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import type {
  InstagramEditedDraftInput,
  InstagramImportMutationInput,
} from "@/features/instagram/schemas"
import { getCurrentUser } from "@/lib/auth/session"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database"

import {
  logInstagramError,
  logInstagramInfo,
  logInstagramWarning,
  newInstagramTraceId,
} from "./logger"

const maximumImageBytes = 5 * 1024 * 1024
const supportedImages: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

function commaSeparatedValues(value: string, maximum: number) {
  const seen = new Set<string>()
  return value.split(",").flatMap((part) => {
    const item = part.trim().slice(0, 80)
    const normalized = item.toLocaleLowerCase("en")
    if (!item || seen.has(normalized) || seen.size >= maximum) return []
    seen.add(normalized)
    return [item]
  })
}

function optionalNumber(value: string, maximum: number) {
  if (!value) return null
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > maximum) {
    throw new ApiError(422, "INSTAGRAM_DRAFT_INVALID", "Enter valid product pricing and stock values.")
  }
  return number
}

function databaseDraft(input: InstagramEditedDraftInput, currencyCode: string): Json {
  return {
    brand: input.brand || null,
    category_id: input.categoryId || null,
    colours: commaSeparatedValues(input.colours, 30),
    currency: currencyCode,
    description: input.description,
    discount_price: optionalNumber(input.discountPrice, 999_999_999_999),
    name: input.name,
    selling_price: optionalNumber(input.sellingPrice, 999_999_999_999),
    sizes: commaSeparatedValues(input.sizes, 30),
    sku: input.sku || null,
    stock_quantity: optionalNumber(input.stockQuantity, 999_999_999),
    tags: commaSeparatedValues(input.tags, 30).map((tag) => tag.slice(0, 50)),
  }
}

function safeDatabaseMessage(error: { code?: string; message: string }) {
  if (error.code === "42501") {
    return new ApiError(403, "INSTAGRAM_IMPORT_FORBIDDEN", error.message)
  }
  if (error.code === "23505") {
    return new ApiError(
      409,
      "INSTAGRAM_DUPLICATE_CONFIRMATION_REQUIRED",
      "This post may match an existing product. Attach it or explicitly create a new product.",
    )
  }
  if (error.code === "P0002") {
    return new ApiError(404, "INSTAGRAM_IMPORT_NOT_FOUND", error.message)
  }
  if (["22023", "P0001"].includes(error.code ?? "")) {
    return new ApiError(422, "INSTAGRAM_DRAFT_INVALID", error.message)
  }
  if (["42883", "42P01", "PGRST202", "PGRST204", "PGRST205"].includes(error.code ?? "")) {
    return new ApiError(503, "INSTAGRAM_SETUP_REQUIRED", "Apply the Instagram database migration first.")
  }
  return new ApiError(503, "INSTAGRAM_IMPORT_FAILED", "We couldn't update this Instagram import.")
}

function approvedMediaHost(hostname: string) {
  const normalized = hostname.toLocaleLowerCase("en")
  return normalized === "instagram.com"
    || normalized.endsWith(".instagram.com")
    || normalized === "cdninstagram.com"
    || normalized.endsWith(".cdninstagram.com")
    || normalized === "fbcdn.net"
    || normalized.endsWith(".fbcdn.net")
}

function safeSourceUrl(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    if (
      url.protocol !== "https:"
      || (url.port && url.port !== "443")
      || url.username
      || url.password
      || !approvedMediaHost(url.hostname)
    ) return null
    return url
  } catch {
    return null
  }
}

async function limitedBody(response: Response) {
  const length = Number(response.headers.get("content-length"))
  if (Number.isFinite(length) && length > maximumImageBytes) return null
  if (!response.body) return null

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maximumImageBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return { bytes: Buffer.concat(chunks), size }
}

async function fetchApprovedImage(initialUrl: URL) {
  let sourceUrl = initialUrl

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const response = await fetch(sourceUrl, {
      cache: "no-store",
      headers: { Accept: "image/jpeg,image/png,image/webp" },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    })
    if (response.status < 300 || response.status >= 400) return response

    const location = response.headers.get("location")
    await response.body?.cancel()
    if (!location || redirectCount === 3) return null

    const nextUrl = safeSourceUrl(new URL(location, sourceUrl).toString())
    if (!nextUrl) return null
    sourceUrl = nextUrl
  }

  return null
}

async function copyInstagramImage(
  businessId: string,
  draftId: string,
  productId: string,
  userId: string,
) {
  const admin = createAdminClient()
  const draftResult = await admin.from("instagram_product_drafts")
    .select("media_id")
    .eq("business_id", businessId)
    .eq("id", draftId)
    .maybeSingle()
  if (!draftResult.data) return false
  const mediaResult = await admin.from("instagram_media")
    .select("source_media_url, source_thumbnail_url")
    .eq("business_id", businessId)
    .eq("id", draftResult.data.media_id)
    .maybeSingle()
  const sourceUrl = safeSourceUrl(
    mediaResult.data?.source_media_url ?? mediaResult.data?.source_thumbnail_url ?? null,
  )
  if (!sourceUrl) return false

  try {
    const response = await fetchApprovedImage(sourceUrl)
    if (!response?.ok || !safeSourceUrl(response.url)) return false
    const mimeType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase()
    const extension = mimeType ? supportedImages[mimeType] : undefined
    if (!mimeType || !extension) return false
    const body = await limitedBody(response)
    if (!body || body.size <= 0) return false

    const path = `${userId}/${businessId}/${productId}/${crypto.randomUUID()}.${extension}`
    const uploadResult = await admin.storage.from("product-media").upload(path, body.bytes, {
      cacheControl: "31536000",
      contentType: mimeType,
      upsert: false,
    })
    if (uploadResult.error) return false

    const insertResult = await admin.from("product_media").insert({
      business_id: businessId,
      created_by: userId,
      file_name: `instagram-${draftId}.${extension}`,
      file_size: body.size,
      is_primary: true,
      media_kind: "image",
      mime_type: mimeType,
      position: 0,
      product_id: productId,
      storage_path: path,
      variant_id: null,
    })
    if (insertResult.error) {
      await admin.storage.from("product-media").remove([path])
      return false
    }
    return true
  } catch {
    return false
  }
}

export async function manageInstagramImport(
  draftId: string,
  input: InstagramImportMutationInput,
): Promise<JsonHandlerResult<{ productId?: string }>> {
  const traceId = newInstagramTraceId()
  const startedAt = Date.now()
  const user = await getCurrentUser()
  if (!user) {
    logInstagramWarning("import.rejected", { draftId, reason: "auth_required", traceId })
    throw new ApiError(401, "AUTH_REQUIRED", "Sign in to review Instagram imports.")
  }
  const business = await getCurrentBusiness()
  if (!business.permissions.includes("products.manage")) {
    logInstagramWarning("import.rejected", {
      businessId: business.id,
      draftId,
      reason: "products_manage_required",
      traceId,
      userId: user.id,
    })
    throw new ApiError(403, "INSTAGRAM_IMPORT_FORBIDDEN", "You do not have permission to manage products.")
  }

  logInstagramInfo("import.requested", {
    action: input.action,
    businessId: business.id,
    draftId,
    traceId,
    userId: user.id,
  })

  const databaseFailure = (
    stage: string,
    error: { code?: string; message: string },
  ) => {
    logInstagramError("import.database_failed", error, {
      action: input.action,
      businessId: business.id,
      draftId,
      durationMs: Date.now() - startedAt,
      stage,
      traceId,
      userId: user.id,
    })
    return safeDatabaseMessage(error)
  }
  const supabase = await createClient()
  const businessResult = await supabase.from("businesses")
    .select("currency_code")
    .eq("id", business.id)
    .single()
  if (businessResult.error) {
    logInstagramError("import.business_load_failed", businessResult.error, {
      action: input.action,
      businessId: business.id,
      draftId,
      durationMs: Date.now() - startedAt,
      traceId,
      userId: user.id,
    })
    throw new ApiError(503, "INSTAGRAM_IMPORT_FAILED", "We couldn't load the business currency.")
  }

  if (input.action === "save") {
    const { error } = await supabase.rpc("save_instagram_product_draft", {
      edited_product_data: databaseDraft(input.draft, businessResult.data.currency_code),
      target_business_id: business.id,
      target_draft_id: draftId,
    })
    if (error) throw databaseFailure("draft_save", error)
    logInstagramInfo("import.completed", {
      action: input.action,
      businessId: business.id,
      draftId,
      durationMs: Date.now() - startedAt,
      traceId,
      userId: user.id,
    })
    return { data: {}, message: "Instagram draft saved." }
  }

  if (input.action === "attach") {
    const { data, error } = await supabase.rpc("attach_instagram_draft_to_product", {
      target_business_id: business.id,
      target_draft_id: draftId,
      target_product_id: input.productId,
    }).single()
    if (error) throw databaseFailure("existing_product_attach", error)
    logInstagramInfo("import.completed", {
      action: input.action,
      businessId: business.id,
      draftId,
      durationMs: Date.now() - startedAt,
      productId: data?.product_id,
      traceId,
      userId: user.id,
    })
    return {
      data: data ? { productId: data.product_id } : {},
      message: "Instagram post attached to the existing product.",
    }
  }

  if (input.action === "discard") {
    const { error } = await supabase.rpc("resolve_instagram_product_draft", {
      target_business_id: business.id,
      target_draft_id: draftId,
      target_resolution: "ignored",
    })
    if (error) throw databaseFailure("draft_discard", error)
    logInstagramInfo("import.completed", {
      action: input.action,
      businessId: business.id,
      draftId,
      durationMs: Date.now() - startedAt,
      traceId,
      userId: user.id,
    })
    return { data: {}, message: "Instagram import discarded." }
  }

  if (input.draft) {
    const saveResult = await supabase.rpc("save_instagram_product_draft", {
      edited_product_data: databaseDraft(input.draft, businessResult.data.currency_code),
      target_business_id: business.id,
      target_draft_id: draftId,
    })
    if (saveResult.error) throw databaseFailure("pre_approval_save", saveResult.error)
  }
  const { data, error } = await supabase.rpc("approve_instagram_product_draft", {
    confirm_create_new: input.confirmCreateNew,
    requested_product_status: input.publish ? "active" : "draft",
    target_business_id: business.id,
    target_draft_id: draftId,
  }).single()
  if (error) throw databaseFailure("draft_approval", error)
  if (!data) {
    logInstagramWarning("import.approval_missing_result", {
      action: input.action,
      businessId: business.id,
      draftId,
      durationMs: Date.now() - startedAt,
      traceId,
      userId: user.id,
    })
    throw new ApiError(503, "INSTAGRAM_IMPORT_FAILED", "We couldn't create the catalogue product.")
  }

  const imageCopied = await copyInstagramImage(
    business.id,
    draftId,
    data.product_id,
    user.id,
  )
  logInstagramInfo("import.completed", {
    action: input.action,
    businessId: business.id,
    draftId,
    durationMs: Date.now() - startedAt,
    imageCopied,
    productId: data.product_id,
    published: input.publish,
    traceId,
    userId: user.id,
  })
  return {
    data: { productId: data.product_id },
    message: input.publish
      ? imageCopied
        ? "Product approved, published, and its Instagram image was added."
        : "Product approved and published. The Instagram image could not be copied, so you can add one in Catalogue."
      : imageCopied
        ? "Product added to catalogue drafts with its Instagram image."
        : "Product added to catalogue drafts. Add an image from the Catalogue editor.",
    status: 201,
  }
}
