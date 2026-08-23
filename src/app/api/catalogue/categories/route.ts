import { categoryMutationSchema } from "@/features/catalogue/schemas"
import { manageCategory } from "@/features/catalogue/server/manage-categories"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request, categoryMutationSchema, manageCategory)
}
