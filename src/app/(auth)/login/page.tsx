import type { Metadata } from "next"
import Link from "next/link"

import { AuthCard } from "@/features/auth/components/auth-card"
import { LoginForm } from "@/features/auth/components/login-form"
import { getSafeNextPath } from "@/lib/auth/redirect"

export const metadata: Metadata = {
  description: "Sign in to your Carborony business workspace.",
  title: "Sign in",
}

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[]
    next?: string | string[]
    reset?: string | string[]
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams
  const requestedNext = Array.isArray(query.next) ? query.next[0] : query.next
  const resetStatus = Array.isArray(query.reset) ? query.reset[0] : query.reset
  const nextPath = getSafeNextPath(requestedNext)

  return (
    <AuthCard
      description="Enter your details to continue to your business workspace."
      footer={
        <>
          New to Carborony?{" "}
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href="/register"
          >
            Create an account
          </Link>
        </>
      }
      title="Welcome back"
    >
      <LoginForm
        hasLinkError={Boolean(query.error)}
        nextPath={nextPath}
        passwordReset={resetStatus === "success"}
      />
    </AuthCard>
  )
}
