import { forgotPasswordSchema } from "@/features/auth/schemas"
import { forgotPassword } from "@/features/auth/server/service"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  const responseHeaders = new Headers()

  return handleJsonPost(
    request,
    forgotPasswordSchema,
    (input) =>
      forgotPassword(input, new URL(request.url).origin, responseHeaders),
    { responseHeaders },
  )
}
