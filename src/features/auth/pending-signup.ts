const pendingSignupEmailKey = "carborony.pending-signup-email"
const pendingSignupLifetimeMs = 60 * 60 * 1000
export const signupOtpResendCooldownMs = 60 * 1000

type PendingSignup = {
  email: string
  expiresAt: number
  resendAvailableAt: number
}

function readPendingSignup(): PendingSignup | null {
  try {
    const storedValue = window.sessionStorage.getItem(pendingSignupEmailKey)

    if (!storedValue) return null

    const value = JSON.parse(storedValue) as unknown

    if (
      typeof value !== "object" ||
      value === null ||
      !("email" in value) ||
      !("expiresAt" in value) ||
      !("resendAvailableAt" in value) ||
      typeof value.email !== "string" ||
      typeof value.expiresAt !== "number" ||
      typeof value.resendAvailableAt !== "number" ||
      value.expiresAt <= Date.now()
    ) {
      return null
    }

    return value as PendingSignup
  } catch {
    return null
  }
}

export function clearPendingSignupEmail() {
  try {
    window.sessionStorage.removeItem(pendingSignupEmailKey)
  } catch {
    // Session storage may be unavailable in privacy-restricted browsers.
  }
}

export function getPendingSignupEmail() {
  return readPendingSignup()?.email ?? null
}

export function getPendingSignupResendAvailableAt() {
  const resendAvailableAt = readPendingSignup()?.resendAvailableAt ?? 0
  return resendAvailableAt > Date.now() ? resendAvailableAt : 0
}

export function savePendingSignupEmail(
  email: string,
  resendAvailableAt = Date.now() + signupOtpResendCooldownMs,
) {
  try {
    window.sessionStorage.setItem(
      pendingSignupEmailKey,
      JSON.stringify({
        email,
        expiresAt: Date.now() + pendingSignupLifetimeMs,
        resendAvailableAt,
      } satisfies PendingSignup),
    )
  } catch {
    // The verification screen provides a safe route back to registration.
  }
}
