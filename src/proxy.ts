import type { NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/proxy"

export function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    "/app/:path*",
    "/onboarding/:path*",
    "/login",
    "/register",
    "/verify-otp",
    "/forgot-password",
    "/reset-password",
  ],
}
