import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { getSupabaseEnvironment } from "@/lib/supabase/env"
import type { Database } from "@/types/database"

type ServerClientOptions = {
  responseHeaders?: Headers
  strictCookieWrites?: boolean
}

/** Creates a request-scoped Supabase client for Server Components and handlers. */
export async function createClient(options: ServerClientOptions = {}) {
  const cookieStore = await cookies()
  const { anonKey, url } = getSupabaseEnvironment()

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet, headersToSet) {
        try {
          cookiesToSet.forEach(({ name, options: cookieOptions, value }) => {
            cookieStore.set(name, value, cookieOptions)
          })
        } catch (error) {
          if (options.strictCookieWrites) throw error

          // Server Components cannot write cookies. The request Proxy refreshes
          // sessions before rendering; Route Handlers use strict cookie writes.
        }

        Object.entries(headersToSet).forEach(([name, value]) => {
          options.responseHeaders?.set(name, value)
        })
      },
    },
  })
}
