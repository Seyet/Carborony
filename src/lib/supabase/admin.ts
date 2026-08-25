import "server-only"

import { createClient } from "@supabase/supabase-js"

import { getSupabaseAdminEnvironment } from "@/lib/supabase/env"
import type { Database } from "@/types/database"

/** Server-only Supabase client for Auth Admin operations. */
export function createAdminClient() {
  const { serviceRoleKey, url } = getSupabaseAdminEnvironment()

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}
