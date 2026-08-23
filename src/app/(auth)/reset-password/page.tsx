import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { AuthCard } from "@/features/auth/components/auth-card"
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form"
import { getCurrentUser } from "@/lib/auth/session"
import { isSupabaseConfigured } from "@/lib/supabase/env"

export const metadata: Metadata = {
  description: "Choose a new password for your Carborony account.",
  title: "Choose a new password",
}

export default async function ResetPasswordPage() {
  if (!isSupabaseConfigured()) {
    redirect("/forgot-password")
  }

  const user = await getCurrentUser()

  if (!user) {
    redirect("/forgot-password")
  }

  return (
    <AuthCard
      description="Your recovery link is verified. Choose a new password to secure your account."
      footer={
        <Link
          className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline"
          href="/login"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Back to sign in
        </Link>
      }
      title="Choose a new password"
    >
      <ResetPasswordForm />
    </AuthCard>
  )
}
