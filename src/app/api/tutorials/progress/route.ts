import { tutorialProgressSchema } from "@/features/tutorials/schemas"
import { saveTutorialProgress } from "@/features/tutorials/server/progress"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request,tutorialProgressSchema,saveTutorialProgress)
}
