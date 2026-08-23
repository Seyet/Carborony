import "server-only"

import { headers } from "next/headers"

function validOrigin(value: string | null) {
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : null
  } catch {
    return null
  }
}

export async function getRequestOrigin() {
  const requestHeaders = await headers()
  const origin = validOrigin(requestHeaders.get("origin"))

  if (origin) return origin

  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]
  const host = forwardedHost ?? requestHeaders.get("host")

  if (!host) {
    throw new Error("Unable to determine the application URL for the auth callback.")
  }

  const forwardedProtocol = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",")[0]
  const protocol = forwardedProtocol ?? (host.startsWith("localhost") ? "http" : "https")
  const resolvedOrigin = validOrigin(`${protocol}://${host}`)

  if (!resolvedOrigin) {
    throw new Error("Unable to determine the application URL for the auth callback.")
  }

  return resolvedOrigin
}
