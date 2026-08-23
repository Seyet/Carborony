import { registrationSchema } from "@/features/auth/schemas"
import { register } from "@/features/auth/server/service"
import { handleJsonPost } from "@/lib/api/server"
import { getRequestOrigin } from "@/lib/auth/request-url"

export async function POST(request: Request) {
  const responseHeaders = new Headers()

  return handleJsonPost(
    request,
    registrationSchema,
    async (input) =>
      register(input, await getRequestOrigin(), responseHeaders),
    { responseHeaders },
  )
}
