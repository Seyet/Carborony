import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { AuthCard } from "@/features/auth/components/auth-card"
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form"

export const metadata: Metadata = {
  description: "Verify an email code and choose a new password for your account.",
  title: "Forgot password",
}

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      description="Enter your email, verify the code we send, then choose a new password."
      footer={
        <Link
          className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline"
          href="/login"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Back to sign in
        </Link>
      }
      title="Reset your password"
    >
      <ForgotPasswordForm />
    </AuthCard>
  )
}
