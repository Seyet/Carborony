import "server-only"

import type { User } from "@supabase/supabase-js"

const verificationWindowSeconds = 15 * 60
const emailMethods = new Set([
  "email",
  "email/signup",
  "invite",
  "magiclink",
  "otp",
  "recovery",
])

export function hasRecentEmailProof(
  user: User,
  methods: readonly unknown[],
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const earliestAccepted = nowSeconds - verificationWindowSeconds
  const latestAccepted = nowSeconds + 60
  const recentlyInvited = user.invited_at
    && user.user_metadata?.carborony_password_configured !== true
    && user.last_sign_in_at
    && Date.parse(user.last_sign_in_at) >= earliestAccepted * 1000

  if (recentlyInvited) return true

  return methods.some((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false
    const { method, timestamp } = entry as { method?: unknown; timestamp?: unknown }
    return typeof method === "string"
      && emailMethods.has(method)
      && typeof timestamp === "number"
      && timestamp >= earliestAccepted
      && timestamp <= latestAccepted
  })
}
