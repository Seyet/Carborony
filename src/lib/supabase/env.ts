const missingEnvironmentMessage =
  "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."

export function isSupabaseConfigured() {
  try {
    getSupabaseEnvironment()
    return true
  } catch {
    return false
  }
}

export function getSupabaseEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(missingEnvironmentMessage)
  }

  try {
    const parsedUrl = new URL(url)
    const isLocalHost = ["localhost", "127.0.0.1", "[::1]"].includes(
      parsedUrl.hostname,
    )

    if (parsedUrl.protocol !== "https:" && !isLocalHost) {
      throw new Error(missingEnvironmentMessage)
    }
  } catch {
    throw new Error(missingEnvironmentMessage)
  }

  return { anonKey, url }
}

export function getSupabaseAdminEnvironment() {
  const { url } = getSupabaseEnvironment()
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error(
      "Supabase staff invitations are not configured. Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.",
    )
  }

  return { serviceRoleKey, url }
}
