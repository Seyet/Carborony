import { billingContactSettingsSchema } from "@/features/settings/schemas"
import { updateBillingContact } from "@/features/settings/server/manage-settings"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request, billingContactSettingsSchema, updateBillingContact)
}
