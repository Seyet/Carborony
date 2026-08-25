import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { AppShell } from "@/components/layout/app-shell"
import { getCurrentBusinessOrNull } from "@/features/businesses/server/get-current-business"
import { requireUser } from "@/lib/auth/session"

function getInitials(value: string) {
  const initials = value
    .split(/\s+/)
    .map((part) => part.match(/[\p{L}\p{N}]/u)?.[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.toUpperCase())
    .join("")

  return initials || "U"
}

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: ReactNode
}) {
  const [user, currentBusiness] = await Promise.all([
    requireUser(),
    getCurrentBusinessOrNull(),
  ])
  if (
    user.invited_at
    && user.user_metadata?.carborony_password_configured !== true
  ) {
    redirect("/reset-password")
  }
  if (!currentBusiness?.onboardingCompletedAt) redirect("/onboarding/business")
  const metadataName = user.user_metadata?.full_name
  const email = user.email ?? "Signed-in user"
  const name =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : email.split("@")[0] || "Business owner"

  return (
    <AppShell
      business={{
        name: currentBusiness.name,
        initials: getInitials(currentBusiness.name),
        permissions: currentBusiness.permissions,
        roleName: currentBusiness.roleName,
      }}
      user={{
        name,
        email,
        initials: getInitials(name),
      }}
    >
      {children}
    </AppShell>
  )
}
