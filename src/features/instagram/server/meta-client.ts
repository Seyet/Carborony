import "server-only"

import { z } from "zod"

import { getInstagramEnvironment } from "./config"

const graphRequestTimeoutMs = 15_000
const maximumResponseBytes = 2 * 1024 * 1024
const metaIdentifier = z.union([z.string(), z.number().int().nonnegative()])
  .transform(String)
  .pipe(z.string().regex(/^\d+$/).max(128))

const tokenResponseSchema = z.object({
  access_token: z.string().min(1).max(4_096),
  expires_in: z.coerce.number().int().positive().optional(),
  token_type: z.string().optional(),
  user_id: metaIdentifier.optional(),
})

const profileResponseSchema = z.object({
  account_type: z.string().optional(),
  id: metaIdentifier,
  name: z.string().optional(),
  profile_picture_url: z.url().optional(),
  user_id: metaIdentifier.optional(),
  username: z.string().min(1).max(100),
})

const mediaItemSchema = z.object({
  caption: z.string().max(100_000).optional(),
  children: z.object({
    data: z.array(z.object({
      id: metaIdentifier,
      media_type: z.string().optional(),
      media_url: z.url().optional(),
      thumbnail_url: z.url().optional(),
    })).max(20),
  }).optional(),
  id: metaIdentifier,
  media_product_type: z.string().optional(),
  media_type: z.string().min(1),
  media_url: z.url().optional(),
  permalink: z.url(),
  thumbnail_url: z.url().optional(),
  timestamp: z.string().min(1).max(64).refine(
    (value) => Number.isFinite(new Date(value).getTime()),
    "Instagram returned an invalid media timestamp.",
  ),
  username: z.string().optional(),
})

const mediaPageSchema = z.object({
  data: z.array(mediaItemSchema).max(100),
  paging: z.object({
    cursors: z.object({ after: z.string().optional() }).optional(),
    next: z.url().optional(),
  }).optional(),
})

const metaErrorSchema = z.object({
  error: z.object({
    code: z.number().optional(),
    error_subcode: z.number().optional(),
    message: z.string().optional(),
    type: z.string().optional(),
  }),
})

const successResponseSchema = z.union([
  z.literal(true),
  z.object({ success: z.literal(true) }),
])

export type InstagramProfile = z.output<typeof profileResponseSchema>
export type InstagramMediaItem = z.output<typeof mediaItemSchema>

export class MetaInstagramError extends Error {
  readonly metaCode?: number
  readonly metaSubcode?: number
  readonly status: number

  constructor(message: string, status: number, metaCode?: number, metaSubcode?: number) {
    super(message)
    this.name = "MetaInstagramError"
    this.metaCode = metaCode
    this.metaSubcode = metaSubcode
    this.status = status
  }
}

function graphUrl(path: string, parameters?: Record<string, string | undefined>) {
  const { graphVersion } = getInstagramEnvironment()
  const url = new URL(
    path.startsWith("https://")
      ? path
      : `https://graph.instagram.com/${graphVersion}/${path.replace(/^\//, "")}`,
  )

  Object.entries(parameters ?? {}).forEach(([name, value]) => {
    if (value !== undefined) url.searchParams.set(name, value)
  })
  return url
}

async function safeResponseJson(response: Response) {
  const declaredLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > maximumResponseBytes) {
    throw new MetaInstagramError("Meta returned an unexpectedly large response.", 502)
  }

  const text = await response.text()
  if (Buffer.byteLength(text, "utf8") > maximumResponseBytes) {
    throw new MetaInstagramError("Meta returned an unexpectedly large response.", 502)
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new MetaInstagramError("Meta returned an invalid response.", 502)
  }
}

async function metaFetch(url: URL, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(graphRequestTimeoutMs),
  })
  const payload = await safeResponseJson(response)

  if (!response.ok) {
    const parsedError = metaErrorSchema.safeParse(payload)
    throw new MetaInstagramError(
      "Instagram could not complete this request.",
      response.status,
      parsedError.success ? parsedError.data.error.code : undefined,
      parsedError.success ? parsedError.data.error.error_subcode : undefined,
    )
  }

  return payload
}

export function instagramAuthorizationUrl(state: string, requestOrigin?: string) {
  const { appId, redirectUri } = getInstagramEnvironment(requestOrigin)
  const url = new URL("https://www.instagram.com/oauth/authorize")
  url.searchParams.set("force_reauth", "true")
  url.searchParams.set("client_id", appId)
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", "instagram_business_basic")
  url.searchParams.set("state", state)
  return url.toString()
}

export async function exchangeAuthorizationCode(code: string, requestOrigin?: string) {
  const { appId, appSecret, redirectUri } = getInstagramEnvironment(requestOrigin)
  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  })
  const payload = await metaFetch(new URL("https://api.instagram.com/oauth/access_token"), {
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  })
  return tokenResponseSchema.parse(payload)
}

export async function exchangeLongLivedToken(shortLivedToken: string) {
  const { appSecret } = getInstagramEnvironment()
  const payload = await metaFetch(graphUrl("https://graph.instagram.com/access_token", {
    access_token: shortLivedToken,
    client_secret: appSecret,
    grant_type: "ig_exchange_token",
  }))
  return tokenResponseSchema.parse(payload)
}

export async function refreshLongLivedToken(accessToken: string) {
  const payload = await metaFetch(graphUrl("https://graph.instagram.com/refresh_access_token", {
    access_token: accessToken,
    grant_type: "ig_refresh_token",
  }))
  return tokenResponseSchema.parse(payload)
}

export async function getInstagramProfile(accessToken: string) {
  const payload = await metaFetch(graphUrl("me", {
    // Keep this to fields supported consistently by Instagram Login. The OAuth
    // token response can contain `user_id`, but that is not a portable /me field.
    fields: "id,username,account_type",
  }), { headers: { Authorization: `Bearer ${accessToken}` } })
  return profileResponseSchema.parse(payload)
}

export async function getInstagramMedia(
  accessToken: string,
  instagramUserId: string,
  options: { after?: string; limit?: number } = {},
) {
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100))
  const payload = await metaFetch(graphUrl(`${encodeURIComponent(instagramUserId)}/media`, {
    after: options.after,
    fields: [
      "id", "caption", "media_type", "media_product_type", "media_url",
      "thumbnail_url", "permalink", "timestamp", "username",
      "children{id,media_type,media_url,thumbnail_url}",
    ].join(","),
    limit: String(limit),
  }), { headers: { Authorization: `Bearer ${accessToken}` } })
  return mediaPageSchema.parse(payload)
}

export async function revokeInstagramAccess(
  accessToken: string,
  instagramUserId: string,
) {
  const payload = await metaFetch(
    graphUrl(`${encodeURIComponent(instagramUserId)}/permissions`),
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      method: "DELETE",
    },
  )
  const result = successResponseSchema.parse(payload)
  return result === true ? true : result.success
}
