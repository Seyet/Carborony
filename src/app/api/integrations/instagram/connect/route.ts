import { instagramConnectSchema } from "@/features/instagram/schemas"
import { startInstagramConnection } from "@/features/instagram/server/connect-instagram"
import { ApiError, handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request, instagramConnectSchema, async () => {
    const origin = new URL(request.url).origin

    try {
      return await startInstagramConnection(origin)
    } catch (error) {
      if (error instanceof ApiError) throw error
      console.error("Instagram configuration is unavailable", error)
      throw new ApiError(
        503,
        "INSTAGRAM_NOT_CONFIGURED",
        "Instagram connection is not configured yet.",
      )
    }
  })
}
