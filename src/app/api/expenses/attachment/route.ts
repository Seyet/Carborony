import { expenseAttachmentRequestSchema } from "@/features/expenses/schemas"
import { prepareExpenseAttachment } from "@/features/expenses/server/manage-attachment"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(
    request,
    expenseAttachmentRequestSchema,
    prepareExpenseAttachment,
  )
}
