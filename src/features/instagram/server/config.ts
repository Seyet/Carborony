import "server-only"

import { createHash } from "node:crypto"

import { getSupabaseAdminEnvironment } from "@/lib/supabase/env"

const defaultGraphVersion = "v26.0"
const defaultProductionRedirectUri =
  "https://carborony.vercel.app/api/integrations/instagram/callback"

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Instagram is not configured. Set ${name}.`)
  return value
}

function validRedirectUri(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:"
      || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
  } catch {
    return false
  }
}

export function getInstagramEnvironment(requestOrigin?: string) {
  const appId = requiredEnvironment("META_INSTAGRAM_APP_ID")
  const appSecret = requiredEnvironment("META_INSTAGRAM_APP_SECRET")
  const graphVersion = process.env.META_INSTAGRAM_GRAPH_VERSION?.trim()
    || defaultGraphVersion
  const configuredRedirectUri = process.env.META_INSTAGRAM_REDIRECT_URI?.trim()
  const redirectUri = configuredRedirectUri
    || (requestOrigin
      ? `${requestOrigin.replace(/\/$/, "")}/api/integrations/instagram/callback`
      : defaultProductionRedirectUri)

  if (!/^\d+$/.test(appId)) {
    throw new Error("META_INSTAGRAM_APP_ID must be the numeric Instagram app ID.")
  }
  if (!/^v\d+\.\d+$/.test(graphVersion)) {
    throw new Error("META_INSTAGRAM_GRAPH_VERSION must look like v26.0.")
  }
  if (!validRedirectUri(redirectUri)) {
    throw new Error("META_INSTAGRAM_REDIRECT_URI must be HTTPS (or localhost HTTP).")
  }

  return { appId, appSecret, graphVersion, redirectUri }
}

export function getInstagramEncryptionKey() {
  const configured = requiredEnvironment("INSTAGRAM_TOKEN_ENCRYPTION_KEY")
  let key: Buffer

  if (/^[a-f\d]{64}$/i.test(configured)) {
    key = Buffer.from(configured, "hex")
  } else {
    try {
      key = Buffer.from(configured, "base64")
    } catch {
      key = Buffer.alloc(0)
    }
  }

  if (key.byteLength !== 32) {
    throw new Error(
      "INSTAGRAM_TOKEN_ENCRYPTION_KEY must be a base64 or hex encoded 32-byte key.",
    )
  }

  return key
}

export function instagramConfigurationAvailable() {
  try {
    getInstagramEnvironment()
    getInstagramEncryptionKey()
    getSupabaseAdminEnvironment()
    return true
  } catch {
    return false
  }
}

export function accessTokenFingerprint(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}
