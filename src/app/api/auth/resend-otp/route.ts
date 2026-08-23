import { resendSignupOtpSchema } from "@/features/auth/schemas"
import { resendSignupOtp } from "@/features/auth/server/service"
import { handleJsonPost } from "@/lib/api/server"
import { getRequestOrigin } from "@/lib/auth/request-url"

export async function POST(request: Request) {
  const responseHeaders = new Headers()

  return handleJsonPost(
    request,
    resendSignupOtpSchema,
    async (input) =>
      resendSignupOtp(input, await getRequestOrigin(), responseHeaders),
    { responseHeaders },
  )
}
