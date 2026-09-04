import { instagramConnectSchema } from "@/features/instagram/schemas"
import { startInstagramConnection } from "@/features/instagram/server/connect-instagram"
import {
  logInstagramError,
  newInstagramTraceId,
} from "@/features/instagram/server/logger"
import { ApiError, handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  const traceId = newInstagramTraceId()

  return handleJsonPost(request, instagramConnectSchema, async () => {
    const origin = new URL(request.url).origin

    try {
      return await startInstagramConnection(origin, traceId)
    } catch (error) {
      if (error instanceof ApiError) throw error
      logInstagramError("oauth.configuration_failed", error, { traceId })
      throw new ApiError(
        503,
        "INSTAGRAM_NOT_CONFIGURED",
        "Instagram connection is not configured yet.",
      )
    }
  })
}
