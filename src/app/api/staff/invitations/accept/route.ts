import { acceptStaffInvitationSchema } from "@/features/staff/schemas"
import { acceptStaffInvitation } from "@/features/staff/server/manage-staff"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  const responseHeaders = new Headers()
  return handleJsonPost(
    request,
    acceptStaffInvitationSchema,
    (input) => acceptStaffInvitation(input, responseHeaders),
    { responseHeaders },
  )
}
