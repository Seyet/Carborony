import "server-only"

import { cache } from "react"

import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export const getBusinessOnboardingDraft = cache(async () => {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const { data, error } = await supabase.from("businesses").select(
    "address, category_code, country_code, currency_code, description, email, facebook_page, instagram_account, logo_path, name, onboarding_completed_at, opening_hours, phone, website_url, whatsapp_phone",
  ).eq("created_by", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle()

  if (error) throw new Error("Unable to load business onboarding.", { cause: error })
  return data
})
