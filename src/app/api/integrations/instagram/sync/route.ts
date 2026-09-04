import { instagramSyncSchema } from "@/features/instagram/schemas"
import { syncInstagram } from "@/features/instagram/server/sync-instagram"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request, instagramSyncSchema, syncInstagram)
}
