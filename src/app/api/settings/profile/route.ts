import { profileSettingsSchema } from "@/features/settings/schemas"
import { updateProfileSettings } from "@/features/settings/server/manage-settings"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request, profileSettingsSchema, updateProfileSettings, {
    maxBytes: 2 * 1024 * 1024,
  })
}
