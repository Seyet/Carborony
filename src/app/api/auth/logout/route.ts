import { logoutSchema } from "@/features/auth/schemas"
import { logout } from "@/features/auth/server/service"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  const responseHeaders = new Headers()

  return handleJsonPost(
    request,
    logoutSchema,
    () => logout(responseHeaders),
    { responseHeaders },
  )
}
