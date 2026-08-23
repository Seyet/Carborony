import { businessOnboardingSchema } from "@/features/businesses/onboarding/schemas"
import { completeBusinessOnboarding } from "@/features/businesses/onboarding/server/service"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request, businessOnboardingSchema, completeBusinessOnboarding, {
    maxBytes: 1_600_000,
  })
}
