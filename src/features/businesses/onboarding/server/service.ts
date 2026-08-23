import "server-only"

import type { BusinessOnboardingData } from "../api-types"
import type { BusinessOnboardingInput } from "../schemas"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

function slugify(name: string, userId: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "").slice(0, 47).replace(/-$/g, "") || "business"
  return `${base}-${userId.replaceAll("-", "")}`
}

function decodeLogo(dataUrl: string, mimeType: string) {
  const prefix = `data:${mimeType};base64,`
  if (!dataUrl.startsWith(prefix)) {
    throw new ApiError(422, "INVALID_LOGO", "The selected logo is not valid.")
  }

  const bytes = Uint8Array.from(atob(dataUrl.slice(prefix.length)), (char) =>
    char.charCodeAt(0),
  )
  if (!bytes.length || bytes.length > 1_048_576) {
    throw new ApiError(422, "INVALID_LOGO", "Logo must be smaller than 1 MB.")
  }
  return bytes
}

function extensionFor(mimeType: string) {
  return mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1]
}

export async function completeBusinessOnboarding(
  input: BusinessOnboardingInput,
): Promise<JsonHandlerResult<BusinessOnboardingData>> {
  const user = await getCurrentUser()
  if (!user) {
    throw new ApiError(401, "AUTH_REQUIRED", "Sign in to finish setting up your business.")
  }
  const supabase = await createClient()

  const { data: existing, error: lookupError } = await supabase
    .from("businesses")
    .select("id, onboarding_completed_at, logo_path")
    .eq("created_by", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (lookupError) {
    throw new ApiError(503, "ONBOARDING_UNAVAILABLE", "We couldn't load your business setup.")
  }
  if (existing?.onboarding_completed_at) {
    return { data: { redirectTo: "/app/dashboard" }, message: "Business setup is already complete." }
  }

  const businessId = existing?.id ?? crypto.randomUUID()
  let logoPath = existing?.logo_path ?? null

  const businessValues = {
    address: input.address,
    category_code: input.categoryCode,
    country_code: input.countryCode,
    currency_code: input.currencyCode,
    description: input.description,
    email: input.email,
    facebook_page: input.facebookPage,
    instagram_account: input.instagramAccount,
    name: input.name,
    opening_hours: input.openingHours,
    phone: input.phone,
    website_url: input.websiteUrl,
    whatsapp_phone: input.whatsappPhone,
  }

  // Persist a stable draft before uploading. A retry then reuses the same
  // business and object path instead of leaving orphaned logo objects.
  if (!existing) {
    const { error: draftError } = await supabase.from("businesses").insert({
      ...businessValues,
      created_by: user.id,
      id: businessId,
      onboarding_completed_at: null,
      slug: slugify(input.name, user.id),
    })

    if (draftError) {
      console.error("Business onboarding draft creation failed", {
        code: draftError.code,
        details: draftError.details,
        message: draftError.message,
      })

      if (draftError.code === "23503") {
        throw new ApiError(
          409,
          "ACCOUNT_PROFILE_MISSING",
          "Your account profile is incomplete. Please contact support before retrying.",
        )
      }

      throw new ApiError(503, "ONBOARDING_SAVE_FAILED", "We couldn't save your business. Please try again.")
    }
  }

  if (input.logo) {
    logoPath = `${user.id}/${businessId}/logo.${extensionFor(input.logo.mimeType)}`
    const { error: uploadError } = await supabase.storage
      .from("business-logos")
      .upload(logoPath, decodeLogo(input.logo.dataUrl, input.logo.mimeType), {
        contentType: input.logo.mimeType,
        upsert: true,
      })

    if (uploadError) {
      console.error("Business logo upload failed", {
        message: uploadError.message.slice(0, 500),
        name: uploadError.name,
      })
      throw new ApiError(503, "LOGO_UPLOAD_FAILED", "We couldn't upload your logo. Please try again.")
    }
  }

  const values = {
    ...businessValues,
    logo_path: logoPath,
    onboarding_completed_at: new Date().toISOString(),
  }

  const result = await supabase.from("businesses").update(values).eq("id", businessId)

  if (result.error) {
    console.error("Business onboarding persistence failed", {
      code: result.error.code,
      details: result.error.details,
      message: result.error.message,
    })
    throw new ApiError(503, "ONBOARDING_SAVE_FAILED", "We couldn't save your business. Please try again.")
  }

  return {
    data: { redirectTo: "/app/dashboard" },
    message: "Your business is ready.",
  }
}
