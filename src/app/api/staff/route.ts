import { staffMutationSchema } from "@/features/staff/schemas"
import { manageStaff } from "@/features/staff/server/manage-staff"
import { handleJsonPost } from "@/lib/api/server"
import { getRequestOrigin } from "@/lib/auth/request-url"

export async function POST(request: Request) {
  return handleJsonPost(
    request,
    staffMutationSchema,
    async (input) => manageStaff(input, await getRequestOrigin()),
  )
}
