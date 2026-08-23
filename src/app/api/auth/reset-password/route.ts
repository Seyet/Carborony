import { resetPasswordSchema } from "@/features/auth/schemas"
import { resetPassword } from "@/features/auth/server/service"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  const responseHeaders = new Headers()

  return handleJsonPost(
    request,
    resetPasswordSchema,
    (input) => resetPassword(input, responseHeaders),
    { responseHeaders },
  )
}
