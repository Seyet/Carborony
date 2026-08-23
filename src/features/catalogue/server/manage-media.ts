import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import type { MediaMutationData, MediaUploadData } from "../api-types"
import type {
  MediaFinalizeBatchInput,
  MediaMutationInput,
  MediaUploadBatchInput,
} from "../schemas"

async function getMediaActor() {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to manage product media.")
  const business = await getCurrentBusiness()
  const supabase = await createClient()

  return { business, supabase, user }
}

async function requireProduct(productId: string) {
  const actor = await getMediaActor()
  const { business, supabase } = actor
  const productResult = await supabase.from("products").select("id")
    .eq("business_id", business.id).eq("id", productId).maybeSingle()
  if (productResult.error) {
    throw new ApiError(503, "MEDIA_UNAVAILABLE", "We couldn't load this product's media.")
  }
  if (!productResult.data) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "This product could not be found.")
  }

  return actor
}

function extensionForMime(mimeType: string) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  }
  return extensions[mimeType]
}

export async function createMediaUploads(
  productId: string,
  input: MediaUploadBatchInput,
): Promise<JsonHandlerResult<MediaUploadData>> {
  const { business, supabase, user } = await requireProduct(productId)
  const paths = input.files.map((file) => {
    const extension = extensionForMime(file.mimeType)
    if (!extension) {
      throw new ApiError(422, "MEDIA_TYPE_INVALID", "Choose a supported media file.")
    }
    return `${user.id}/${business.id}/${productId}/${crypto.randomUUID()}.${extension}`
  })
  const results = await Promise.all(paths.map((path) =>
    supabase.storage.from("product-media").createSignedUploadUrl(path),
  ))
  const failedResult = results.find((result) => result.error || !result.data)

  if (failedResult?.error || results.some((result) => !result.data)) {
    console.error("Product media upload URL creation failed", {
      message: failedResult?.error?.message,
    })
    throw new ApiError(503, "MEDIA_UPLOAD_UNAVAILABLE", "We couldn't prepare this upload.")
  }

  return {
    data: {
      uploads: results.map((result) => ({
        path: result.data!.path,
        token: result.data!.token,
      })),
    },
  }
}

export async function finalizeMediaUploads(
  productId: string,
  input: MediaFinalizeBatchInput,
): Promise<JsonHandlerResult<MediaMutationData>> {
  const { business, supabase, user } = await getMediaActor()
  const requiredPrefix = `${user.id}/${business.id}/${productId}/`
  const storageFileNames = input.items.map((item) => {
    if (!item.storagePath.startsWith(requiredPrefix)) {
      throw new ApiError(422, "MEDIA_PATH_INVALID", "The uploaded media path is invalid.")
    }
    const storageFileName = item.storagePath.slice(requiredPrefix.length)
    if (!storageFileName || storageFileName.includes("/")) {
      throw new ApiError(422, "MEDIA_PATH_INVALID", "The uploaded media path is invalid.")
    }
    return storageFileName
  })

  const variantIds = input.items
    .map((item) => item.variantId)
    .filter((variantId): variantId is string => Boolean(variantId))
  const hasProductImage = input.items.some((item) =>
    item.kind === "image" && !item.variantId,
  )
  const [objectResult, variantsResult, existingResult, primaryResult] = await Promise.all([
    supabase.storage.from("product-media")
      .list(requiredPrefix.replace(/\/$/, ""), { limit: 1_000 }),
    variantIds.length
      ? supabase.from("product_variants").select("id")
        .eq("business_id", business.id).eq("product_id", productId)
        .in("id", variantIds)
      : Promise.resolve(null),
    variantIds.length
      ? supabase.from("product_media").select("id, storage_path")
        .eq("business_id", business.id).eq("product_id", productId)
        .in("variant_id", variantIds).eq("media_kind", "image")
      : Promise.resolve(null),
    hasProductImage
      ? supabase.from("product_media").select("id")
        .eq("business_id", business.id).eq("product_id", productId)
        .eq("media_kind", "image").is("variant_id", null).limit(1)
      : Promise.resolve(null),
  ])

  const uploadedNames = new Set(objectResult.data?.map((item) => item.name) ?? [])
  if (objectResult.error || storageFileNames.some((fileName) => !uploadedNames.has(fileName))) {
    throw new ApiError(422, "MEDIA_UPLOAD_MISSING", "Upload the media file before saving it.")
  }

  if (variantIds.length) {
    if (variantsResult?.error || variantsResult?.data?.length !== variantIds.length) {
      throw new ApiError(422, "VARIANT_MEDIA_INVALID", "Select a valid product variant.")
    }
    if (existingResult?.error) {
      throw new ApiError(503, "MEDIA_SAVE_FAILED", "We couldn't save the variant images.")
    }
    if (existingResult?.data?.length) {
      const deleteResult = await supabase.from("product_media").delete()
        .eq("business_id", business.id)
        .in("id", existingResult.data.map((media) => media.id))
      if (deleteResult.error) {
        throw new ApiError(503, "MEDIA_SAVE_FAILED", "We couldn't replace the variant images.")
      }
      await supabase.storage.from("product-media")
        .remove(existingResult.data.map((media) => media.storage_path))
    }
  }

  if (primaryResult?.error) {
    throw new ApiError(503, "MEDIA_SAVE_FAILED", "We couldn't save this product media.")
  }

  /*
   * The signed upload paths are product-scoped and the metadata insert is
   * protected by product_media RLS/FKs, so another product lookup here would
   * only repeat authorization already enforced by the database.
   */

  let primaryAssigned = Boolean(primaryResult?.data?.length)
  const ids = input.items.map(() => crypto.randomUUID())
  const insertResult = await supabase.from("product_media").insert(
    input.items.map((item, index) => {
      const isPrimary = item.kind === "image" && !item.variantId && !primaryAssigned
      if (isPrimary) primaryAssigned = true

      return {
        business_id: business.id,
        created_by: user.id,
        file_name: item.fileName,
        file_size: item.fileSize,
        id: ids[index],
        is_primary: isPrimary,
        media_kind: item.kind,
        mime_type: item.mimeType,
        position: item.position,
        product_id: productId,
        storage_path: item.storagePath,
        variant_id: item.variantId,
      }
    }),
  )
  if (insertResult.error) {
    console.error("Product media metadata creation failed", {
      code: insertResult.error.code,
      message: insertResult.error.message,
    })
    await supabase.storage.from("product-media")
      .remove(input.items.map((item) => item.storagePath))
    throw new ApiError(503, "MEDIA_SAVE_FAILED", "We couldn't save this product media.")
  }

  return {
    data: { mediaIds: ids },
    message: `${ids.length} media ${ids.length === 1 ? "file" : "files"} uploaded.`,
    status: 201,
  }
}

export async function manageMedia(
  productId: string,
  input: MediaMutationInput,
): Promise<JsonHandlerResult<MediaMutationData>> {
  const { business, supabase } = await getMediaActor()

  if (input.action === "reorder") {
    const reorderResult = await supabase.rpc("reorder_product_media", {
      ordered_media_ids: input.orderedIds,
      target_business_id: business.id,
      target_product_id: productId,
    })
    if (reorderResult.error) {
      if (reorderResult.error.message === "The media order is invalid.") {
        throw new ApiError(422, "MEDIA_ORDER_INVALID", reorderResult.error.message)
      }
      throw new ApiError(503, "MEDIA_ORDER_FAILED", "We couldn't reorder the product media.")
    }
    return { data: {}, message: "Media order updated." }
  }

  const mediaResult = await supabase.from("product_media")
    .select("id, storage_path, media_kind, variant_id, is_primary")
    .eq("business_id", business.id).eq("product_id", productId)
    .eq("id", input.mediaId).maybeSingle()
  if (mediaResult.error) {
    throw new ApiError(503, "MEDIA_UNAVAILABLE", "We couldn't load this media item.")
  }
  if (!mediaResult.data) {
    throw new ApiError(404, "MEDIA_NOT_FOUND", "This media item could not be found.")
  }

  if (input.action === "primary") {
    if (mediaResult.data.media_kind !== "image" || mediaResult.data.variant_id) {
      throw new ApiError(422, "PRIMARY_MEDIA_INVALID", "Only product images can be primary.")
    }
    const updateResult = await supabase.rpc("set_primary_product_media", {
      target_business_id: business.id,
      target_media_id: input.mediaId,
      target_product_id: productId,
    })
    if (updateResult.error) {
      throw new ApiError(503, "PRIMARY_MEDIA_FAILED", "We couldn't update the primary image.")
    }
    return { data: { mediaId: input.mediaId }, message: "Primary image updated." }
  }

  const deleteResult = await supabase.from("product_media").delete()
    .eq("business_id", business.id).eq("product_id", productId).eq("id", input.mediaId)
  if (deleteResult.error) {
    throw new ApiError(503, "MEDIA_DELETE_FAILED", "We couldn't delete this media item.")
  }
  const storageResult = await supabase.storage.from("product-media")
    .remove([mediaResult.data.storage_path])
  if (storageResult.error) {
    console.error("Product media object cleanup failed", { message: storageResult.error.message })
  }

  if (mediaResult.data.is_primary) {
    const nextResult = await supabase.from("product_media").select("id")
      .eq("business_id", business.id).eq("product_id", productId)
      .eq("media_kind", "image").is("variant_id", null)
      .order("position").limit(1).maybeSingle()
    if (nextResult.data) {
      await supabase.from("product_media").update({ is_primary: true })
        .eq("business_id", business.id).eq("id", nextResult.data.id)
    }
  }

  return { data: { mediaId: input.mediaId }, message: "Media deleted." }
}
