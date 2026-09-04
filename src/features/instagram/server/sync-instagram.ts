import "server-only"

import { createHash } from "node:crypto"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { extractInstagramCaption } from "@/features/instagram/extraction"
import { getCurrentUser } from "@/lib/auth/session"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database"

import { accessTokenFingerprint } from "./config"
import {
  getInstagramMedia,
  MetaInstagramError,
  refreshLongLivedToken,
  revokeInstagramAccess,
  type InstagramMediaItem,
} from "./meta-client"
import { decryptInstagramToken, encryptInstagramToken } from "./token-vault"

const refreshWindowMs = 7 * 24 * 60 * 60 * 1_000

function setupError(code?: string) {
  return ["42883", "42P01", "PGRST202", "PGRST204", "PGRST205"].includes(code ?? "")
}

function captionHash(caption: string | undefined) {
  return createHash("sha256").update(caption ?? "", "utf8").digest("hex")
}

function normalizedProductName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function nameTokens(value: string) {
  return new Set(normalizedProductName(value).split(" ").filter((token) => token.length > 1))
}

function productSimilarity(left: string, right: string) {
  const leftName = normalizedProductName(left)
  const rightName = normalizedProductName(right)
  if (!leftName || !rightName) return 0
  if (leftName === rightName) return 1

  const leftTokens = nameTokens(leftName)
  const rightTokens = nameTokens(rightName)
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length
  const tokenScore = intersection / Math.max(leftTokens.size, rightTokens.size, 1)
  const containment = leftName.includes(rightName) || rightName.includes(leftName) ? 0.9 : 0
  return Math.max(tokenScore, containment)
}

function closestProduct(
  proposedName: string | null,
  products: Array<{ id: string; name: string }>,
) {
  if (!proposedName) return null
  const match = products
    .map((product) => ({ ...product, score: productSimilarity(proposedName, product.name) }))
    .sort((left, right) => right.score - left.score)[0]
  return match && match.score >= 0.82 ? match : null
}

function mappedMediaType(media: InstagramMediaItem) {
  const mediaType = media.media_type.toLocaleUpperCase("en")
  const productType = media.media_product_type?.toLocaleUpperCase("en")
  if (mediaType === "CAROUSEL_ALBUM") return "carousel"
  if (productType === "REELS") return "reel"
  if (mediaType === "VIDEO") return "video"
  return "image"
}

function primarySourceUrl(media: InstagramMediaItem) {
  if (mappedMediaType(media) === "image") return media.media_url ?? null
  if (mappedMediaType(media) === "carousel") {
    const firstImage = media.children?.data.find(
      (child) => child.media_type?.toLocaleUpperCase("en") === "IMAGE" && child.media_url,
    )
    const firstPreview = media.children?.data.find(
      (child) => child.thumbnail_url || child.media_url,
    )
    return firstImage?.media_url
      ?? firstPreview?.thumbnail_url
      ?? firstPreview?.media_url
      ?? media.thumbnail_url
      ?? null
  }
  return media.thumbnail_url ?? null
}

function extractionPayload(
  extraction: ReturnType<typeof extractInstagramCaption>,
  duplicate: { id: string; score: number } | null,
): Json {
  return {
    brand: extraction.brand.value,
    category_id: extraction.category.value?.id ?? null,
    colours: extraction.colours.value ?? [],
    currency: extraction.currency.value,
    delivery_information: extraction.deliveryInformation.value,
    description: extraction.description.value ?? "",
    discount_price: extraction.discountPrice.value,
    duplicate_product_id: duplicate?.id ?? null,
    duplicate_score: duplicate?.score ?? null,
    name: extraction.name.value,
    promotional_information: extraction.promotionalInformation.value,
    selling_price: extraction.sellingPrice.value,
    sizes: extraction.sizes.value ?? [],
    sku: null,
    stock_quantity: extraction.stockQuantity.value,
    tags: [],
    warnings: extraction.warnings,
  }
}

function confidencePayload(
  extraction: ReturnType<typeof extractInstagramCaption>,
): Json {
  const confidence = (field: { confidence: number; evidence: string | null }) => ({
    confidence: field.confidence,
    evidence: field.evidence,
  })
  return {
    brand: confidence(extraction.brand),
    category_id: confidence(extraction.category),
    colours: confidence(extraction.colours),
    currency: confidence(extraction.currency),
    description: confidence(extraction.description),
    discount_price: confidence(extraction.discountPrice),
    name: confidence(extraction.name),
    selling_price: confidence(extraction.sellingPrice),
    sizes: confidence(extraction.sizes),
    stock_quantity: confidence(extraction.stockQuantity),
  }
}

async function usableAccessToken(
  connectionId: string,
  connectionGeneration: number,
  ciphertext: string,
  encryptionVersion: number,
  expiresAt: string | null,
) {
  let accessToken = decryptInstagramToken(ciphertext, encryptionVersion)
  let tokenExpiresAt = expiresAt
  const expirationTime = tokenExpiresAt ? new Date(tokenExpiresAt).getTime() : Number.POSITIVE_INFINITY

  if (expirationTime <= Date.now()) {
    throw new ApiError(
      409,
      "INSTAGRAM_REAUTHORIZATION_REQUIRED",
      "The Instagram connection has expired. Reconnect the account to continue.",
    )
  }

  if (expirationTime - Date.now() <= refreshWindowMs) {
    const refreshed = await refreshLongLivedToken(accessToken)
    accessToken = refreshed.access_token
    tokenExpiresAt = refreshed.expires_in
      ? new Date(Date.now() + refreshed.expires_in * 1_000).toISOString()
      : tokenExpiresAt
    const encrypted = encryptInstagramToken(accessToken)
    const admin = createAdminClient()
    const { error } = await admin.rpc("replace_instagram_connection_credential", {
      target_connection_id: connectionId,
      target_connection_generation: connectionGeneration,
      target_encrypted_access_token: encrypted.ciphertext,
      target_encryption_version: encrypted.version,
      target_token_expires_at: tokenExpiresAt,
      target_token_fingerprint: accessTokenFingerprint(accessToken),
    })
    if (error) throw new Error("Unable to store the refreshed Instagram credential.", { cause: error })
  }

  return accessToken
}

export async function syncInstagram(): Promise<JsonHandlerResult<{
  draftsCreated: number
  postsReceived: number
}>> {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to sync Instagram.")
  const business = await getCurrentBusiness()
  if (business.roleCode !== "owner") {
    throw new ApiError(403, "INSTAGRAM_SYNC_FORBIDDEN", "Only the business owner can sync Instagram.")
  }

  const supabase = await createClient()
  const connectionResult = await supabase.from("instagram_connections")
    .select("id, instagram_user_id, status, token_expires_at")
    .eq("business_id", business.id)
    .maybeSingle()
  if (connectionResult.error) {
    if (setupError(connectionResult.error.code)) {
      throw new ApiError(503, "INSTAGRAM_SETUP_REQUIRED", "Apply the Instagram database migration first.")
    }
    throw new ApiError(503, "INSTAGRAM_SYNC_FAILED", "We couldn't load the Instagram connection.")
  }
  const connection = connectionResult.data
  if (!connection || connection.status !== "connected") {
    throw new ApiError(409, "INSTAGRAM_NOT_CONNECTED", "Connect Instagram before syncing posts.")
  }

  const admin = createAdminClient()
  const runResult = await admin.rpc("start_instagram_sync_run", {
    target_actor_id: user.id,
    target_business_id: business.id,
    target_connection_id: connection.id,
  }).single()
  if (runResult.error) {
    if (runResult.error.code === "55006") {
      throw new ApiError(409, "INSTAGRAM_SYNC_RUNNING", "An Instagram sync is already running.")
    }
    if (runResult.error.code === "P0001") {
      throw new ApiError(
        429,
        "INSTAGRAM_SYNC_COOLDOWN",
        "Instagram was synced recently. Try again in a few minutes.",
      )
    }
    if (setupError(runResult.error.code)) {
      throw new ApiError(503, "INSTAGRAM_SETUP_REQUIRED", "Apply the Instagram database migration first.")
    }
    throw new ApiError(503, "INSTAGRAM_SYNC_FAILED", "We couldn't start the Instagram sync.")
  }
  if (!runResult.data) {
    throw new ApiError(503, "INSTAGRAM_SYNC_FAILED", "We couldn't start the Instagram sync.")
  }
  const runId = runResult.data.run_id
  const connectionGeneration = runResult.data.connection_generation

  try {
    const credentialResult = await admin.rpc("get_instagram_connection_credential", {
      target_connection_id: connection.id,
      target_connection_generation: connectionGeneration,
    }).single()
    if (credentialResult.error || !credentialResult.data) {
      throw new ApiError(
        409,
        "INSTAGRAM_REAUTHORIZATION_REQUIRED",
        "Reconnect Instagram before syncing posts.",
      )
    }
    const accessToken = await usableAccessToken(
      connection.id,
      connectionGeneration,
      credentialResult.data.encrypted_access_token,
      credentialResult.data.encryption_version,
      credentialResult.data.token_expires_at,
    )

    const [mediaPage, categoryResult, productResult] = await Promise.all([
      getInstagramMedia(accessToken, connection.instagram_user_id, { limit: 25 }),
      supabase.from("categories")
        .select("id, name")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("position")
        .limit(500),
      supabase.from("products")
        .select("id, name")
        .eq("business_id", business.id)
        .neq("status", "archived")
        .limit(1_000),
    ])
    if (categoryResult.error || productResult.error) {
      throw new Error("Unable to prepare Instagram product extraction.")
    }

    const businessResult = await supabase.from("businesses")
      .select("currency_code")
      .eq("id", business.id)
      .single()
    if (businessResult.error) throw new Error("Unable to load the business currency.")

    let draftsCreated = 0
    for (const media of mediaPage.data) {
      const extraction = extractInstagramCaption({
        businessCurrencyCode: businessResult.data.currency_code,
        caption: media.caption ?? "",
        categories: categoryResult.data ?? [],
      })
      const duplicate = closestProduct(extraction.name.value, productResult.data ?? [])
      const ingestResult = await admin.rpc("ingest_instagram_media", {
        confidence_payload: confidencePayload(extraction),
        extraction_payload: extractionPayload(extraction, duplicate),
        media_payload: {
          caption: media.caption ?? null,
          caption_hash: captionHash(media.caption),
          instagram_media_id: media.id,
          media_product_type: media.media_product_type ?? null,
          media_type: mappedMediaType(media),
          permalink: media.permalink,
          raw_metadata: {
            child_count: media.children?.data.length ?? 0,
            username: media.username ?? null,
          },
          source_media_url: primarySourceUrl(media),
          source_published_at: media.timestamp,
          source_thumbnail_url: media.thumbnail_url ?? primarySourceUrl(media),
          staged_media_path: null,
        },
        target_business_id: business.id,
        target_connection_id: connection.id,
        target_connection_generation: connectionGeneration,
      }).single()
      if (ingestResult.error) {
        throw new Error("Unable to save an Instagram post.", { cause: ingestResult.error })
      }
      if (ingestResult.data?.was_created) draftsCreated += 1
    }

    const completedAt = new Date().toISOString()
    const [runCompletion, connectionCompletion] = await Promise.all([
      admin.from("instagram_sync_runs").update({
        completed_at: completedAt,
        cursor_after: mediaPage.paging?.cursors?.after ?? null,
        drafts_created: draftsCreated,
        posts_created: draftsCreated,
        posts_received: mediaPage.data.length,
        posts_updated: Math.max(0, mediaPage.data.length - draftsCreated),
        status: "completed",
      }).eq("id", runId)
        .eq("connection_generation", connectionGeneration)
        .eq("status", "running")
        .select("id")
        .maybeSingle(),
      admin.from("instagram_connections").update({
        last_error_code: null,
        last_error_message: null,
        last_synced_at: completedAt,
        next_sync_at: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
        status: "connected",
      }).eq("id", connection.id)
        .eq("connection_generation", connectionGeneration)
        .eq("status", "connected")
        .select("id")
        .maybeSingle(),
    ])
    if (runCompletion.error || connectionCompletion.error) {
      throw new Error("Unable to finalize the Instagram sync.", {
        cause: runCompletion.error ?? connectionCompletion.error,
      })
    }
    if (!runCompletion.data || !connectionCompletion.data) {
      throw new ApiError(
        409,
        "INSTAGRAM_CONNECTION_CHANGED",
        "The Instagram connection changed during this sync. No further changes were saved.",
      )
    }

    return {
      data: { draftsCreated, postsReceived: mediaPage.data.length },
      message: draftsCreated
        ? `${draftsCreated} new Instagram ${draftsCreated === 1 ? "draft is" : "drafts are"} ready to review.`
        : "Instagram is up to date.",
    }
  } catch (error) {
    const requiresAuthorization = (error instanceof ApiError
      && error.code === "INSTAGRAM_REAUTHORIZATION_REQUIRED")
      || (error instanceof MetaInstagramError
        && ([102, 190].includes(error.metaCode ?? 0) || error.status === 401))
    const errorCode = requiresAuthorization ? "REAUTHORIZATION_REQUIRED" : "SYNC_FAILED"
    const errorMessage = requiresAuthorization
      ? "Reconnect Instagram to resume imports."
      : "The latest Instagram sync could not be completed."
    const [runFailure, connectionFailure] = await Promise.all([
      admin.from("instagram_sync_runs").update({
        completed_at: new Date().toISOString(),
        error_code: errorCode,
        error_message: errorMessage,
        status: "failed",
      }).eq("id", runId)
        .eq("connection_generation", connectionGeneration)
        .eq("status", "running"),
      admin.from("instagram_connections").update({
        last_error_code: errorCode,
        last_error_message: errorMessage,
        status: requiresAuthorization ? "needs_reauthorization" : "connected",
      }).eq("id", connection.id)
        .eq("connection_generation", connectionGeneration)
        .eq("status", "connected"),
    ])
    if (runFailure.error || connectionFailure.error) {
      console.error("Instagram sync failure bookkeeping failed", {
        connectionUpdateCode: connectionFailure.error?.code,
        runUpdateCode: runFailure.error?.code,
      })
    }

    if (error instanceof ApiError) throw error
    console.error("Instagram sync failed", {
      metaCode: error instanceof MetaInstagramError ? error.metaCode : undefined,
      name: error instanceof Error ? error.name : "UnknownError",
    })
    throw new ApiError(
      requiresAuthorization ? 409 : 502,
      requiresAuthorization ? "INSTAGRAM_REAUTHORIZATION_REQUIRED" : "INSTAGRAM_SYNC_FAILED",
      errorMessage,
    )
  }
}

export async function disconnectInstagram(): Promise<JsonHandlerResult<Record<string, never>>> {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to disconnect Instagram.")
  const business = await getCurrentBusiness()
  if (business.roleCode !== "owner") {
    throw new ApiError(403, "INSTAGRAM_DISCONNECT_FORBIDDEN", "Only the business owner can disconnect Instagram.")
  }
  const supabase = await createClient()
  const connectionResult = await supabase.from("instagram_connections")
    .select("id, instagram_user_id, connection_generation")
    .eq("business_id", business.id)
    .maybeSingle()
  if (connectionResult.error) {
    if (setupError(connectionResult.error.code)) {
      throw new ApiError(503, "INSTAGRAM_SETUP_REQUIRED", "Apply the Instagram database migration first.")
    }
    throw new ApiError(503, "INSTAGRAM_DISCONNECT_FAILED", "We couldn't load the Instagram connection.")
  }
  if (!connectionResult.data) {
    throw new ApiError(404, "INSTAGRAM_NOT_CONNECTED", "No Instagram account is connected.")
  }

  const admin = createAdminClient()
  const credentialResult = await admin.rpc("get_instagram_connection_credential", {
    target_connection_id: connectionResult.data.id,
    target_connection_generation: connectionResult.data.connection_generation,
  }).maybeSingle()
  if (credentialResult.error && !setupError(credentialResult.error.code)) {
    throw new ApiError(503, "INSTAGRAM_DISCONNECT_FAILED", "We couldn't load the Instagram credential.")
  }

  if (credentialResult.data) {
    try {
      const accessToken = decryptInstagramToken(
        credentialResult.data.encrypted_access_token,
        credentialResult.data.encryption_version,
      )
      await revokeInstagramAccess(accessToken, connectionResult.data.instagram_user_id)
    } catch (error) {
      const alreadyInvalid = error instanceof MetaInstagramError
        && ([100, 102, 190].includes(error.metaCode ?? 0) || error.status === 401)
      if (!alreadyInvalid) {
        console.error("Instagram authorization revocation failed", {
          metaCode: error instanceof MetaInstagramError ? error.metaCode : undefined,
          name: error instanceof Error ? error.name : "UnknownError",
        })
        throw new ApiError(
          502,
          "INSTAGRAM_DISCONNECT_FAILED",
          "Instagram could not revoke access. Please try disconnecting again.",
        )
      }
    }
  }

  const { data, error } = await admin.rpc("disconnect_instagram_connection", {
    target_actor_id: user.id,
    target_business_id: business.id,
    target_connection_generation: connectionResult.data.connection_generation,
  })
  if (error) {
    if (setupError(error.code)) {
      throw new ApiError(503, "INSTAGRAM_SETUP_REQUIRED", "Apply the Instagram database migration first.")
    }
    throw new ApiError(503, "INSTAGRAM_DISCONNECT_FAILED", "We couldn't disconnect Instagram.")
  }
  if (!data) {
    throw new ApiError(
      409,
      "INSTAGRAM_CONNECTION_CHANGED",
      "The Instagram connection changed while it was being disconnected. Refresh and try again.",
    )
  }
  return { data: {}, message: "Instagram disconnected. Existing products were not changed." }
}
