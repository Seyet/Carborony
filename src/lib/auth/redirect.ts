const defaultAuthenticatedPath = "/app/dashboard"

export function getSafeNextPath(
  value: string | null | undefined,
  fallback = defaultAuthenticatedPath,
) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return fallback
  }

  return value
}
