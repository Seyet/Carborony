import { z } from "zod"

import type {
  MediaMutationData,
  MediaUploadData,
} from "@/features/catalogue/api-types"
import {
  mediaFinalizeBatchSchema,
  mediaMutationSchema,
  mediaUploadBatchSchema,
} from "@/features/catalogue/schemas"
import {
  createMediaUploads,
  finalizeMediaUploads,
  manageMedia,
} from "@/features/catalogue/server/manage-media"
import { handleJsonPost, jsonError } from "@/lib/api/server"

const paramsSchema = z.object({ id: z.uuid() })
const mediaRequestSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("prepare"), payload: mediaUploadBatchSchema }),
  z.object({ operation: z.literal("finalize"), payload: mediaFinalizeBatchSchema }),
  z.object({ operation: z.literal("manage"), payload: mediaMutationSchema }),
])

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const validation = paramsSchema.safeParse(await context.params)
  if (!validation.success) return jsonError(400, "INVALID_PRODUCT", "The requested product is invalid.")

  return handleJsonPost<
    typeof mediaRequestSchema,
    MediaMutationData | MediaUploadData
  >(request, mediaRequestSchema, (input) => {
    if (input.operation === "prepare") {
      return createMediaUploads(validation.data.id, input.payload)
    }
    if (input.operation === "finalize") {
      return finalizeMediaUploads(validation.data.id, input.payload)
    }
    return manageMedia(validation.data.id, input.payload)
  })
}
