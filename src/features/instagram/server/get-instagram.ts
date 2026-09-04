import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { ApiError } from "@/lib/api/server"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database"

import type {
  InstagramConnection,
  InstagramDraftField,
  InstagramFieldConfidence,
  InstagramImportReviewData,
  InstagramImportStatus,
  InstagramMediaType,
  InstagramWorkspaceData,
} from "../types"

export class InstagramSetupRequiredError extends Error {
  constructor() {
    super("The Instagram catalogue migration has not been applied.")
    this.name = "InstagramSetupRequiredError"
  }
}

export const disconnectedInstagramConnection: InstagramConnection = {
  accountId: null,
  accountType: null,
  connectedAt: null,
  lastSyncedAt: null,
  status: "disconnected",
  syncEnabled: false,
  tokenExpiresAt: null,
  username: null,
}

function setupError(code?: string) {
  return ["42883", "42P01", "42703", "PGRST202", "PGRST204", "PGRST205"].includes(code ?? "")
}

function record(value: Json | null): Record<string, Json | undefined> {
  return value && !Array.isArray(value) && typeof value === "object" ? value : {}
}

function text(value: Json | undefined) {
  return typeof value === "string" ? value : null
}

function number(value: Json | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function strings(value: Json | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function effectiveData(extracted: Json, edited: Json) {
  const editedRecord = record(edited)
  return Object.keys(editedRecord).length ? editedRecord : record(extracted)
}

function connectionFromRow(row: {
  account_type: string
  connected_at: string
  instagram_user_id: string
  last_synced_at: string | null
  status: string
  sync_enabled: boolean
  token_expires_at: string | null
  username: string
} | null): InstagramConnection {
  if (!row) return disconnectedInstagramConnection
  const allowedStatuses: InstagramConnection["status"][] = [
    "connected", "disconnected", "error", "expired", "needs_reauthorization",
  ]
  return {
    accountId: row.instagram_user_id,
    accountType: row.account_type === "business" ? "business" : "creator",
    connectedAt: row.connected_at,
    lastSyncedAt: row.last_synced_at,
    status: allowedStatuses.includes(row.status as InstagramConnection["status"])
      ? row.status as InstagramConnection["status"]
      : "error",
    syncEnabled: row.sync_enabled,
    tokenExpiresAt: row.token_expires_at,
    username: row.username,
  }
}

function mediaType(value: string): InstagramMediaType {
  return ["image", "video", "reel", "carousel"].includes(value)
    ? value as InstagramMediaType
    : "image"
}

function importStatus(value: string): InstagramImportStatus {
  const statuses: InstagramImportStatus[] = [
    "attached", "catalogue_draft", "failed", "ignored", "incomplete", "needs_review",
    "possible_duplicate", "published", "ready",
  ]
  return statuses.includes(value as InstagramImportStatus)
    ? value as InstagramImportStatus
    : "failed"
}

function confidenceMap(value: Json) {
  const mapped = new Map<string, InstagramFieldConfidence>()
  Object.entries(record(value)).forEach(([name, rawField]) => {
    const raw = record(rawField ?? null)
    const confidence = number(raw.confidence)
    if (confidence === null) return
    mapped.set(name, {
      confidence: Math.max(0, Math.min(1, confidence)),
      evidence: text(raw.evidence),
    })
  })
  return mapped
}

function overallConfidence(confidences: Map<string, InstagramFieldConfidence>) {
  const values = ["name", "category_id", "selling_price", "colours"]
    .map((key) => confidences.get(key)?.confidence)
    .filter((value): value is number => value !== undefined)
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0
}

export async function getInstagramWorkspace(): Promise<InstagramWorkspaceData> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const connectionResult = await supabase.from("instagram_connections")
    .select("instagram_user_id, username, account_type, status, sync_enabled, token_expires_at, connected_at, last_synced_at")
    .eq("business_id", business.id)
    .maybeSingle()
  if (connectionResult.error) {
    if (setupError(connectionResult.error.code)) throw new InstagramSetupRequiredError()
    throw new Error("Unable to load the Instagram connection.", { cause: connectionResult.error })
  }

  const draftsResult = business.permissions.includes("products.view")
    ? await supabase.from("instagram_product_drafts")
        .select("id, media_id, extracted_data, edited_data, field_confidence, status, duplicate_product_id, duplicate_score, created_at")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [], error: null }
  if (draftsResult.error) {
    if (setupError(draftsResult.error.code)) throw new InstagramSetupRequiredError()
    throw new Error("Unable to load Instagram imports.", { cause: draftsResult.error })
  }

  const drafts = draftsResult.data ?? []
  const mediaIds = drafts.map((draft) => draft.media_id)
  const duplicateIds = drafts.flatMap((draft) => draft.duplicate_product_id ? [draft.duplicate_product_id] : [])
  const [mediaResult, duplicateResult, categoriesResult] = await Promise.all([
    mediaIds.length
      ? supabase.from("instagram_media")
          .select("id, caption, media_type, permalink, source_media_url, source_thumbnail_url, source_published_at")
          .eq("business_id", business.id)
          .in("id", mediaIds)
      : Promise.resolve({ data: [], error: null }),
    duplicateIds.length
      ? supabase.from("products").select("id, name")
          .eq("business_id", business.id).in("id", duplicateIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("categories").select("id, name").eq("business_id", business.id),
  ])
  const secondaryError = mediaResult.error ?? duplicateResult.error ?? categoriesResult.error
  if (secondaryError) throw new Error("Unable to prepare Instagram imports.", { cause: secondaryError })

  const mediaById = new Map((mediaResult.data ?? []).map((item) => [item.id, item]))
  const productsById = new Map((duplicateResult.data ?? []).map((item) => [item.id, item]))
  const categoriesById = new Map((categoriesResult.data ?? []).map((item) => [item.id, item.name]))

  return {
    canConnect: business.roleCode === "owner",
    canManage: business.permissions.includes("products.manage"),
    connection: connectionFromRow(connectionResult.data),
    imports: drafts.flatMap((draft) => {
      const media = mediaById.get(draft.media_id)
      if (!media) return []
      const data = effectiveData(draft.extracted_data, draft.edited_data)
      const confidence = confidenceMap(draft.field_confidence)
      const proposedName = text(data.name)
      const categoryId = text(data.category_id)
      const price = number(data.selling_price)
      const stock = number(data.stock_quantity)
      const missingFields = [
        !proposedName ? "Product name" : null,
        !categoryId ? "Category" : null,
        price === null ? "Price" : null,
        stock === null ? "Stock quantity" : null,
      ].filter((item): item is string => Boolean(item))
      const duplicate = draft.duplicate_product_id
        ? productsById.get(draft.duplicate_product_id)
        : null

      return [{
        caption: media.caption,
        duplicate: duplicate ? {
          name: duplicate.name,
          productId: duplicate.id,
          score: Number(draft.duplicate_score ?? 0),
        } : null,
        id: draft.id,
        mediaType: mediaType(media.media_type),
        permalink: media.permalink,
        publishedAt: media.source_published_at,
        status: importStatus(draft.status),
        suggested: {
          category: categoryId ? categoriesById.get(categoryId) ?? null : null,
          colours: strings(data.colours),
          currency: text(data.currency),
          missingFields,
          name: proposedName,
          overallConfidence: overallConfidence(confidence),
          price,
        },
        thumbnailUrl: media.source_thumbnail_url ?? media.source_media_url,
      }]
    }),
    isPreview: false,
  }
}

function reviewConfidence(value: Json) {
  const source = confidenceMap(value)
  const result: Partial<Record<InstagramDraftField, InstagramFieldConfidence>> = {}
  const keys: Array<[string, InstagramDraftField]> = [
    ["brand", "brand"], ["category_id", "categoryId"], ["colours", "colours"],
    ["description", "description"], ["discount_price", "discountPrice"],
    ["name", "name"], ["selling_price", "sellingPrice"], ["sizes", "sizes"],
    ["stock_quantity", "stockQuantity"],
  ]
  keys.forEach(([sourceKey, targetKey]) => {
    const field = source.get(sourceKey)
    if (field) result[targetKey] = field
  })
  return result
}

export async function getInstagramImportReview(
  draftId: string,
): Promise<InstagramImportReviewData> {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const [draftResult, connectionResult, categoriesResult, businessResult] = await Promise.all([
    supabase.from("instagram_product_drafts")
      .select("id, media_id, extracted_data, edited_data, field_confidence, status, duplicate_product_id, duplicate_score")
      .eq("business_id", business.id)
      .eq("id", draftId)
      .maybeSingle(),
    supabase.from("instagram_connections").select("username")
      .eq("business_id", business.id).maybeSingle(),
    supabase.from("categories").select("id, name")
      .eq("business_id", business.id).eq("is_active", true).order("position").order("name"),
    supabase.from("businesses").select("currency_code").eq("id", business.id).single(),
  ])
  const firstError = draftResult.error ?? connectionResult.error
    ?? categoriesResult.error ?? businessResult.error
  if (firstError) {
    if (setupError(firstError.code)) throw new InstagramSetupRequiredError()
    throw new Error("Unable to load this Instagram import.", { cause: firstError })
  }
  if (!draftResult.data) {
    throw new ApiError(404, "INSTAGRAM_IMPORT_NOT_FOUND", "This Instagram import could not be found.")
  }

  const draft = draftResult.data
  const mediaResult = await supabase.from("instagram_media")
    .select("caption, media_type, permalink, source_media_url, source_thumbnail_url, source_published_at")
    .eq("business_id", business.id).eq("id", draft.media_id).maybeSingle()
  if (mediaResult.error || !mediaResult.data) {
    throw new ApiError(404, "INSTAGRAM_IMPORT_NOT_FOUND", "The Instagram source post could not be found.")
  }
  const duplicateResult = draft.duplicate_product_id
    ? await supabase.from("products").select("id, name")
        .eq("business_id", business.id).eq("id", draft.duplicate_product_id).maybeSingle()
    : { data: null, error: null }
  if (duplicateResult.error) throw new Error("Unable to load the possible duplicate.")

  const data = effectiveData(draft.extracted_data, draft.edited_data)
  const stringNumber = (value: Json | undefined) => {
    const parsed = number(value)
    return parsed === null ? "" : String(parsed)
  }
  const resolved = ["catalogue_draft", "published", "attached", "ignored"].includes(draft.status)

  return {
    businessCurrency: businessResult.data?.currency_code ?? "NGN",
    canManage: business.permissions.includes("products.manage") && !resolved,
    categories: categoriesResult.data ?? [],
    connectionUsername: connectionResult.data?.username ?? "instagram",
    draft: {
      brand: text(data.brand) ?? "",
      categoryId: text(data.category_id) ?? "",
      colours: strings(data.colours).join(", "),
      description: text(data.description) ?? "",
      discountPrice: stringNumber(data.discount_price),
      name: text(data.name) ?? "",
      sellingPrice: stringNumber(data.selling_price),
      sizes: strings(data.sizes).join(", "),
      sku: text(data.sku) ?? "",
      stockQuantity: stringNumber(data.stock_quantity),
      tags: strings(data.tags).join(", "),
    },
    duplicateCandidates: duplicateResult.data ? [{
      name: duplicateResult.data.name,
      productId: duplicateResult.data.id,
      score: Number(draft.duplicate_score ?? 0),
    }] : [],
    fieldConfidence: reviewConfidence(draft.field_confidence),
    id: draft.id,
    isPreview: false,
    source: {
      caption: mediaResult.data.caption,
      mediaType: mediaType(mediaResult.data.media_type),
      mediaUrl: mediaResult.data.source_media_url ?? mediaResult.data.source_thumbnail_url,
      permalink: mediaResult.data.permalink,
      publishedAt: mediaResult.data.source_published_at,
    },
  }
}

export async function getInstagramConnectionForSettings() {
  const business = await getCurrentBusiness()
  const supabase = await createClient()
  const result = await supabase.from("instagram_connections")
    .select("instagram_user_id, username, account_type, status, sync_enabled, token_expires_at, connected_at, last_synced_at")
    .eq("business_id", business.id)
    .maybeSingle()
  if (result.error) {
    if (setupError(result.error.code)) {
      return { connection: disconnectedInstagramConnection, setupReady: false }
    }
    throw new Error("Unable to load the Instagram integration.", { cause: result.error })
  }
  return { connection: connectionFromRow(result.data), setupReady: true }
}
