import { businessProfileSettingsSchema } from "@/features/settings/schemas"
import { updateBusinessProfileSettings } from "@/features/settings/server/manage-settings"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(
    request,
    businessProfileSettingsSchema,
    updateBusinessProfileSettings,
    { maxBytes: 2 * 1024 * 1024 },
  )
}
