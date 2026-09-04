import { instagramImportMutationSchema } from "@/features/instagram/schemas"
import { manageInstagramImport } from "@/features/instagram/server/manage-import"
import { handleJsonPost, jsonError } from "@/lib/api/server"
import { z } from "zod"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  if (!z.uuid().safeParse(id).success) {
    return jsonError(404, "INSTAGRAM_IMPORT_NOT_FOUND", "This Instagram import could not be found.")
  }
  return handleJsonPost(request, instagramImportMutationSchema, (input) =>
    manageInstagramImport(id, input),
  )
}
