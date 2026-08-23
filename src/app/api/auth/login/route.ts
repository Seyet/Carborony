import { loginSchema } from "@/features/auth/schemas"
import { login } from "@/features/auth/server/service"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  const responseHeaders = new Headers()

  return handleJsonPost(
    request,
    loginSchema,
    (input) => login(input, responseHeaders),
    { responseHeaders },
  )
}
