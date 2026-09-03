import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { publicStorageUrl } from "@/features/storefront/server/media-url"
import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database"
import type {
  BillingContactSettingsInput,
  BusinessProfileSettingsInput,
  ProfileSettingsInput,
  RegionalSettingsInput,
  SecuritySettingsInput,
} from "../schemas"
import type { SettingsMutationData } from "../types"

type ImageChange = ProfileSettingsInput["avatar"]

function decodeImage(change: Extract<ImageChange, { action: "replace" }>) {
  const prefix = `data:${change.mimeType};base64,`
  if (!change.dataUrl.startsWith(prefix)) {
    throw new ApiError(422, "INVALID_IMAGE", "The selected image is not valid.")
  }
  const bytes = Uint8Array.from(atob(change.dataUrl.slice(prefix.length)), (character) =>
    character.charCodeAt(0),
  )
  if (!bytes.length || bytes.length > 1_048_576) {
    throw new ApiError(422, "INVALID_IMAGE", "The image must be smaller than 1 MB.")
  }
  return bytes
}

async function authenticatedClient(responseHeaders?: Headers) {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to update settings.")
  const supabase = await createClient({ responseHeaders, strictCookieWrites: Boolean(responseHeaders) })
  return { supabase, user }
}

function requireBusinessPermission(
  business: Awaited<ReturnType<typeof getCurrentBusiness>>,
  permission: "settings.manage" | "settings.view",
) {
  if (!business.permissions.includes(permission)) {
    throw new ApiError(403, "SETTINGS_ACCESS_DENIED", "You do not have permission to update business settings.")
  }
}

export async function updateBillingContact(
  input: BillingContactSettingsInput,
): Promise<JsonHandlerResult<SettingsMutationData>> {
  const business = await getCurrentBusiness()
  if (business.roleCode !== "owner") {
    throw new ApiError(403, "BILLING_OWNER_REQUIRED", "Only the business owner can update billing details.")
  }
  const { supabase } = await authenticatedClient()
  const update = await supabase.rpc("update_billing_contact", {
    target_billing_email: input.billingEmail,
    target_business_id: business.id,
  })

  if (update.error) {
    throw new ApiError(503, "BILLING_CONTACT_SAVE_FAILED", "We couldn't save the billing contact.")
  }

  return { data: {}, message: "Billing contact updated." }
}

export async function updateProfileSettings(
  input: ProfileSettingsInput,
): Promise<JsonHandlerResult<SettingsMutationData>> {
  const { supabase, user } = await authenticatedClient()
  let avatarUrl: string | null | undefined

  if (input.avatar.action === "replace") {
    const path = `${user.id}/avatar`
    const upload = await supabase.storage.from("profile-avatars").upload(
      path,
      decodeImage(input.avatar),
      { contentType: input.avatar.mimeType, upsert: true },
    )
    if (upload.error) {
      throw new ApiError(503, "AVATAR_UPLOAD_FAILED", "We couldn't upload your profile photo.")
    }
    avatarUrl = supabase.storage.from("profile-avatars").getPublicUrl(path).data.publicUrl
  } else if (input.avatar.action === "remove") {
    const removal = await supabase.storage.from("profile-avatars").remove([`${user.id}/avatar`])
    if (removal.error) {
      throw new ApiError(503, "AVATAR_REMOVE_FAILED", "We couldn't remove your profile photo.")
    }
    avatarUrl = null
  }

  const values: { avatar_url?: string | null; full_name: string; phone: string | null } = {
    full_name: input.fullName,
    phone: input.phone,
  }
  if (avatarUrl !== undefined) values.avatar_url = avatarUrl

  const update = await supabase.from("profiles").update(values).eq("id", user.id)
  if (update.error) {
    throw new ApiError(503, "PROFILE_SAVE_FAILED", "We couldn't save your profile.")
  }

  return {
    data: avatarUrl === undefined ? {} : { avatarUrl },
    message: "Profile updated.",
  }
}

export async function updateBusinessProfileSettings(
  input: BusinessProfileSettingsInput,
): Promise<JsonHandlerResult<SettingsMutationData>> {
  const business = await getCurrentBusiness()
  requireBusinessPermission(business, "settings.manage")
  const { supabase, user } = await authenticatedClient()
  let logoPath: string | null | undefined

  if (input.logo.action === "replace") {
    logoPath = `${user.id}/${business.id}/settings-logo`
    const upload = await supabase.storage.from("business-logos").upload(
      logoPath,
      decodeImage(input.logo),
      { contentType: input.logo.mimeType, upsert: true },
    )
    if (upload.error) {
      throw new ApiError(503, "LOGO_UPLOAD_FAILED", "We couldn't upload the business logo.")
    }
  } else if (input.logo.action === "remove") {
    logoPath = null
  }

  const values: {
    address: string | null
    category_code: string
    description: string | null
    email: string | null
    facebook_page: string | null
    instagram_account: string | null
    logo_path?: string | null
    name: string
    opening_hours: Json
    phone: string
    website_url: string | null
    whatsapp_phone: string | null
  } = {
    address: input.address,
    category_code: input.categoryCode,
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
  if (logoPath !== undefined) values.logo_path = logoPath

  const update = await supabase.from("businesses").update(values).eq("id", business.id)
  if (update.error) {
    throw new ApiError(503, "BUSINESS_SAVE_FAILED", "We couldn't save the business profile.")
  }

  return {
    data: logoPath === undefined
      ? {}
      : { logoUrl: publicStorageUrl("business-logos", logoPath) },
    message: "Business profile updated.",
  }
}

export async function updateRegionalSettings(
  input: RegionalSettingsInput,
): Promise<JsonHandlerResult<SettingsMutationData>> {
  const business = await getCurrentBusiness()
  requireBusinessPermission(business, "settings.manage")
  const { supabase } = await authenticatedClient()
  const current = await supabase.from("businesses")
    .select("currency_code")
    .eq("id", business.id)
    .single()

  if (current.error || !current.data) {
    throw new ApiError(503, "SETTINGS_UNAVAILABLE", "We couldn't verify the current regional settings.")
  }
  if (current.data.currency_code !== input.currencyCode && business.roleCode !== "owner") {
    throw new ApiError(403, "CURRENCY_OWNER_REQUIRED", "Only the business owner can change the currency.")
  }

  const update = await supabase.from("businesses").update({
    country_code: input.countryCode,
    currency_code: input.currencyCode,
    date_format: input.dateFormat,
    locale: input.locale,
    time_format: input.timeFormat,
    timezone: input.timezone,
    week_starts_on: input.weekStartsOn,
  }).eq("id", business.id)

  if (update.error) {
    throw new ApiError(503, "REGIONAL_SAVE_FAILED", "We couldn't save the regional settings.")
  }

  return { data: {}, message: "Regional settings updated." }
}

export async function updateSecuritySettings(
  input: SecuritySettingsInput,
  responseHeaders: Headers,
): Promise<JsonHandlerResult<SettingsMutationData>> {
  const { supabase, user } = await authenticatedClient(responseHeaders)

  if (input.action === "change_password") {
    if (!user.email) {
      throw new ApiError(422, "PASSWORD_LOGIN_UNAVAILABLE", "Use Forgot password to secure this account.")
    }

    const verification = await supabase.auth.signInWithPassword({
      email: user.email,
      password: input.currentPassword,
    })
    if (verification.error || verification.data.user.id !== user.id) {
      const rateLimited = verification.error?.code === "over_request_rate_limit"
      throw new ApiError(
        rateLimited ? 429 : 422,
        rateLimited ? "RATE_LIMITED" : "CURRENT_PASSWORD_INCORRECT",
        rateLimited
          ? "Too many attempts. Wait a moment and try again."
          : "Your current password is incorrect.",
      )
    }

    const result = await supabase.auth.updateUser({
      current_password: input.currentPassword,
      data: { carborony_password_configured: true },
      password: input.password,
    })
    if (result.error) {
      const requiresReauthentication = result.error.code === "reauthentication_needed"
      throw new ApiError(
        requiresReauthentication ? 409 : 422,
        requiresReauthentication ? "REAUTHENTICATION_REQUIRED" : "PASSWORD_UPDATE_FAILED",
        requiresReauthentication
          ? "For your security, sign out and use Forgot password before changing your password."
          : result.error.message,
      )
    }
    return { data: {}, message: "Password updated." }
  }

  const result = await supabase.auth.signOut({ scope: "others" })
  if (result.error) {
    throw new ApiError(503, "SESSION_REVOKE_FAILED", "We couldn't sign out your other sessions.")
  }
  return { data: {}, message: "Other sessions signed out." }
}
