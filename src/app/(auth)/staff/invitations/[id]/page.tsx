import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ClockAlert, ShieldX } from "lucide-react"
import { z } from "zod"

import { ButtonLink } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  InvitationAcceptance,
  InvitationSignOutButton,
} from "@/features/staff/invitation-acceptance"
import { getMyStaffInvitation } from "@/features/staff/server/get-staff"

export const metadata: Metadata = {
  description: "Review and accept your Carborony staff invitation.",
  title: "Accept staff invitation",
}

function UnavailableInvitation({ expired = false }: { expired?: boolean }) {
  const Icon = expired ? ClockAlert : ShieldX

  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex flex-col items-center px-7 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <h1 className="mt-4 text-xl font-semibold">
          {expired ? "Invitation expired" : "Invitation unavailable"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {expired
            ? "Ask the business owner to resend your invitation from Staff management."
            : "This link may belong to another account, or the invitation was accepted or revoked."}
        </p>
        <ButtonLink className="mt-6" href="/app/dashboard" variant="outline">
          Go to dashboard
        </ButtonLink>
        <InvitationSignOutButton />
      </CardContent>
    </Card>
  )
}

export default async function StaffInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const validation = z.uuid().safeParse((await params).id)
  if (!validation.success) notFound()

  const invitation = await getMyStaffInvitation(validation.data)

  if (!invitation) return <UnavailableInvitation />
  if (invitation.status !== "pending") {
    return <UnavailableInvitation expired={invitation.status === "expired"} />
  }

  return <InvitationAcceptance invitation={invitation} />
}
