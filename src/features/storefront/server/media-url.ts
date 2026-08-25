import "server-only"

import { getSupabaseEnvironment } from "@/lib/supabase/env"

export function publicStorageUrl(bucket: string, path: string | null) {
  if (!path) return null
  const { url } = getSupabaseEnvironment()
  const encodedPath = path.split("/").map(encodeURIComponent).join("/")
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${encodedPath}`
}
