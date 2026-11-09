import { verifyLoginOtpSchema } from "@/features/auth/schemas"
import { verifyLoginOtp } from "@/features/auth/server/service"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  const responseHeaders = new Headers()
  return handleJsonPost(request, verifyLoginOtpSchema,
    (input) => verifyLoginOtp(input, responseHeaders), { responseHeaders })
}
