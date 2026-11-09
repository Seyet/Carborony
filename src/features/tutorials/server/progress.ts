import "server-only"

import { ApiError, type JsonHandlerResult } from "@/lib/api/server"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import type { TutorialProgress } from "../guides"
import type { TutorialProgressInput } from "../schemas"

export async function getTutorialProgress(userId: string): Promise<TutorialProgress> {
  const supabase = await createClient()
  const [preferences, modules] = await Promise.all([
    supabase.from("user_tutorial_preferences").select("automatic").eq("user_id",userId).maybeSingle(),
    supabase.from("user_module_tutorials").select("module_id").eq("user_id",userId),
  ])
  if (preferences.error || modules.error) {
    // A missing migration must not make the business workspace unavailable.
    console.error("Tutorial progress unavailable", { code: preferences.error?.code ?? modules.error?.code })
    return { automatic: false, handledModules: [] }
  }
  return { automatic: preferences.data?.automatic ?? true, handledModules: (modules.data ?? []).map(row=>row.module_id) }
}

export async function saveTutorialProgress(input: TutorialProgressInput): Promise<JsonHandlerResult<{ saved: true }>> {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401,"AUTH_REQUIRED","Sign in to save your guide preferences.")
  const supabase = await createClient()
  const result = input.action === "disable"
    ? await supabase.from("user_tutorial_preferences").upsert({ user_id: user.id, automatic: false },{ onConflict:"user_id" })
    : await supabase.from("user_module_tutorials").upsert({ user_id:user.id, module_id:input.moduleId, status:input.status },{ onConflict:"user_id,module_id" })
  if (result.error) {
    console.error("Tutorial progress save failed",{ code:result.error.code })
    throw new ApiError(503,"TUTORIAL_SAVE_FAILED","Your guide progress couldn't be saved. You can still use the app and reopen Page guide anytime.")
  }
  return { data:{ saved:true } }
}
