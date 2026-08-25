import "server-only"

import { revalidatePath } from "next/cache"

import { getCurrentUser } from "@/lib/auth/session"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { createClient } from "@/lib/supabase/server"
import type { StorefrontBannerRequestSchemaInput } from "../schemas"
import type { StorefrontBannerResult, StorefrontBannerUpload } from "../types"
import { publicStorageUrl } from "./media-url"

const bannerBucket = "storefront-media"
const allowedExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

async function getBannerActor() {
  const [user, business] = await Promise.all([getCurrentUser(), getCurrentBusiness()])
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to manage the website banner.")
  if (!business.permissions.includes("settings.manage")) {
    throw new ApiError(403, "STOREFRONT_FORBIDDEN", "You do not have permission to manage this storefront.")
  }
  return { business, supabase: await createClient(), user }
}

function pathPrefix(userId: string, businessId: string) {
  return `${userId}/${businessId}/storefront/`
}

export async function manageStorefrontBanner(
  input: StorefrontBannerRequestSchemaInput,
): Promise<JsonHandlerResult<StorefrontBannerUpload | StorefrontBannerResult>> {
  const { business, supabase, user } = await getBannerActor()
  const prefix = pathPrefix(user.id, business.id)

  if (input.operation === "prepare") {
    const extension = allowedExtensions[input.payload.mimeType]
    const path = `${prefix}${crypto.randomUUID()}.${extension}`
    const { data, error } = await supabase.storage.from(bannerBucket).createSignedUploadUrl(path)
    if (error || !data) {
      throw new ApiError(503, "BANNER_UPLOAD_UNAVAILABLE", "We couldn't prepare the banner upload. Please try again.")
    }
    return { data: { path: data.path, token: data.token } }
  }

  const storefrontResult = await supabase.from("storefronts")
    .select("hero_banner_path").eq("business_id", business.id).maybeSingle()
  if (storefrontResult.error) {
    throw new ApiError(503, "STOREFRONT_SETUP_REQUIRED", "Apply the storefront database migrations first.")
  }
  if (!storefrontResult.data) {
    throw new ApiError(503, "STOREFRONT_SETUP_REQUIRED", "Apply the storefront database migrations first.")
  }

  if (input.operation === "remove") {
    const existingPath = storefrontResult.data.hero_banner_path
    const { error: updateError } = await supabase.from("storefronts")
      .update({ hero_banner_path: null }).eq("business_id", business.id)
    if (updateError) throw new ApiError(503, "BANNER_SAVE_FAILED", "We couldn't remove the website banner. Please try again.")
    if (existingPath?.startsWith(prefix)) await supabase.storage.from(bannerBucket).remove([existingPath])
    revalidatePath("/app/website")
    revalidatePath("/store/[slug]", "page")
    return { data: { bannerUrl: null }, message: "Website banner removed." }
  }

  const { storagePath } = input.payload
  if (!storagePath.startsWith(prefix) || !/\.(jpg|png|webp)$/.test(storagePath)) {
    throw new ApiError(422, "BANNER_PATH_INVALID", "The uploaded banner is not valid.")
  }
  const fileName = storagePath.slice(prefix.length)
  if (!fileName || fileName.includes("/")) {
    throw new ApiError(422, "BANNER_PATH_INVALID", "The uploaded banner is not valid.")
  }
  const { data: objects, error: listError } = await supabase.storage.from(bannerBucket)
    .list(prefix.replace(/\/$/, ""), { limit: 100 })
  if (listError || !(objects ?? []).some((object) => object.name === fileName)) {
    throw new ApiError(422, "BANNER_UPLOAD_MISSING", "Upload the banner image before saving it.")
  }
  const existingPath = storefrontResult.data.hero_banner_path
  const { error: updateError } = await supabase.from("storefronts")
    .update({ hero_banner_path: storagePath }).eq("business_id", business.id)
  if (updateError) throw new ApiError(503, "BANNER_SAVE_FAILED", "We couldn't save the website banner. Please try again.")
  if (existingPath && existingPath !== storagePath && existingPath.startsWith(prefix)) {
    await supabase.storage.from(bannerBucket).remove([existingPath])
  }
  revalidatePath("/app/website")
  revalidatePath("/store/[slug]", "page")
  return {
    data: { bannerUrl: publicStorageUrl(bannerBucket, storagePath) },
    message: "Website banner updated.",
  }
}
