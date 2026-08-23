import type { Metadata } from "next"
import Link from "next/link"

import { AuthCard } from "@/features/auth/components/auth-card"
import { RegisterForm } from "@/features/auth/components/register-form"

export const metadata: Metadata = {
  description: "Create your Carborony account.",
  title: "Create account",
}

export default function RegisterPage() {
  return (
    <AuthCard
      description="Create your business workspace, then verify your email to continue."
      footer={
        <>
          Already have an account?{" "}
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href="/login"
          >
            Sign in
          </Link>
        </>
      }
      title="Create your account"
    >
      <RegisterForm />
    </AuthCard>
  )
}
