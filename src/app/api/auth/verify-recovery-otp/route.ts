import { verifyRecoveryOtpSchema } from "@/features/auth/schemas"
import { verifyRecoveryOtp } from "@/features/auth/server/service"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  const responseHeaders = new Headers()

  return handleJsonPost(
    request,
    verifyRecoveryOtpSchema,
    (input) => verifyRecoveryOtp(input, responseHeaders),
    { responseHeaders },
  )
}
