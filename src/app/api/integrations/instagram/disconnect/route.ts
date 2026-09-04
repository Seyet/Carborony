import { instagramDisconnectSchema } from "@/features/instagram/schemas"
import { disconnectInstagram } from "@/features/instagram/server/sync-instagram"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request, instagramDisconnectSchema, disconnectInstagram)
}
