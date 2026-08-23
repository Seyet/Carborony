import { createBrowserClient } from "@supabase/ssr"

import { getSupabaseEnvironment } from "@/lib/supabase/env"
import type { Database } from "@/types/database"

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined

export function createClient() {
  const { anonKey, url } = getSupabaseEnvironment()

  browserClient ??= createBrowserClient<Database>(url, anonKey)

  return browserClient
}
