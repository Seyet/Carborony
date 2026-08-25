import "server-only"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { createClient } from "@/lib/supabase/server"
import type { ActivityArea, ActivityPageData } from "../types"

export const activityPageSize = 20

export class ActivitySetupRequiredError extends Error {
  constructor() {
    super("The activity log migration has not been applied.")
    this.name = "ActivitySetupRequiredError"
  }
}

export class ActivityAccessDeniedError extends Error {
  constructor() {
    super("You do not have permission to view the activity log.")
    this.name = "ActivityAccessDeniedError"
  }
}

function isSetupError(code: string) {
  return ["42883", "PGRST202", "PGRST204", "PGRST205"].includes(code)
}

export async function getActivityPageData({
  area,
  page,
  query,
}: {
  area: ActivityArea | ""
  page: number
  query: string
}): Promise<ActivityPageData> {
  const business = await getCurrentBusiness()
  if (!business.permissions.includes("activity.view")) {
    throw new ActivityAccessDeniedError()
  }

  const supabase = await createClient()
  const [activityResult, businessResult] = await Promise.all([
    supabase.rpc("search_business_activity", {
      result_limit: activityPageSize,
      result_offset: (page - 1) * activityPageSize,
      search_query: query || undefined,
      selected_area: area || undefined,
      target_business_id: business.id,
    }),
    supabase.from("businesses")
      .select("timezone")
      .eq("id", business.id)
      .single(),
  ])

  if (activityResult.error) {
    if (isSetupError(activityResult.error.code)) {
      throw new ActivitySetupRequiredError()
    }
    if (activityResult.error.code === "42501") {
      throw new ActivityAccessDeniedError()
    }
    throw new Error("Unable to load the activity log.", {
      cause: activityResult.error,
    })
  }
  if (businessResult.error) {
    throw new Error("Unable to load the business timezone.", {
      cause: businessResult.error,
    })
  }

  const rows = activityResult.data ?? []
  const totalCount = Number(rows[0]?.total_count ?? 0)

  return {
    items: rows.map((row) => ({
      action: row.action,
      actorName: row.actor_name,
      actorUserId: row.actor_user_id,
      entityId: row.entity_id,
      entityName: row.entity_name,
      entityType: row.entity_type,
      id: row.activity_id,
      newValue: row.new_value,
      occurredAt: row.occurred_at,
      previousValue: row.previous_value,
    })),
    page,
    pageCount: Math.max(1, Math.ceil(totalCount / activityPageSize)),
    timezone: businessResult.data.timezone,
    totalCount,
  }
}
