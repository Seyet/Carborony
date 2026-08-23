import type { Metadata } from "next"
import Link from "next/link"

import { AuthCard } from "@/features/auth/components/auth-card"
import { OtpVerificationForm } from "@/features/auth/components/otp-verification-form"

export const metadata: Metadata = {
  description: "Verify your email address to finish creating your account.",
  title: "Verify email",
}

export default function VerifyOtpPage() {
  return (
    <AuthCard
      description="Enter your registration email and the one-time code we sent to finish setting up your account."
      footer={
        <>
          Have an account?{" "}
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href="/login"
          >
            Sign in
          </Link>
        </>
      }
      title="Verify your email"
    >
      <OtpVerificationForm />
    </AuthCard>
  )
}
