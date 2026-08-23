import { verifySignupOtpSchema } from "@/features/auth/schemas"
import { verifySignupOtp } from "@/features/auth/server/service"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  const responseHeaders = new Headers()

  return handleJsonPost(
    request,
    verifySignupOtpSchema,
    (input) => verifySignupOtp(input, responseHeaders),
    { responseHeaders },
  )
}
