import { securitySettingsSchema } from "@/features/settings/schemas"
import { updateSecuritySettings } from "@/features/settings/server/manage-settings"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  const responseHeaders = new Headers()
  return handleJsonPost(
    request,
    securitySettingsSchema,
    async (input) => updateSecuritySettings(
      input,
      responseHeaders,
    ),
    { responseHeaders },
  )
}
