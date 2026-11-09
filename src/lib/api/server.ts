import "server-only"

import { z } from "zod"

import type {
  ApiFailure,
  ApiFieldErrors,
  ApiSuccess,
} from "@/types/api"

const defaultMaxJsonBytes = 16 * 1024
const jsonContentType = "application/json; charset=utf-8"

type JsonResponseInit = {
  headers?: Headers
  message?: string
  status?: number
}

export type JsonHandlerResult<TData> = {
  data: TData
  message?: string
  status?: number
}

export type HandleJsonPostOptions = {
  maxBytes?: number
  requireSameOrigin?: boolean
  responseHeaders?: Headers
}

export class ApiError extends Error {
  readonly code: string
  readonly fields?: ApiFieldErrors
  readonly status: number

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: ApiFieldErrors,
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.fields = fields
  }
}

function applyResponseHeaders(response: Response, headers?: Headers) {
  if (headers) {
    headers.forEach((value, name) => {
      if (name.toLowerCase() !== "set-cookie") {
        response.headers.set(name, value)
      }
    })

    headers.getSetCookie().forEach((cookie) => {
      response.headers.append("set-cookie", cookie)
    })
  }

  const cacheControl = response.headers.get("cache-control")

  if (!cacheControl?.toLowerCase().includes("no-store")) {
    response.headers.set(
      "Cache-Control",
      cacheControl ? `${cacheControl}, private, no-store` : "private, no-store",
    )
  }

  response.headers.set("Content-Type", jsonContentType)
  if (!response.headers.has("Expires")) response.headers.set("Expires", "0")
  if (!response.headers.has("Pragma")) response.headers.set("Pragma", "no-cache")

  return response
}

export function jsonSuccess<TData>(
  data: TData,
  { headers, message, status = 200 }: JsonResponseInit = {},
) {
  const body: ApiSuccess<TData> = message !== undefined
    ? { data, message, ok: true }
    : { data, ok: true }

  return applyResponseHeaders(Response.json(body, { status }), headers)
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  fields?: ApiFieldErrors,
  headers?: Headers,
) {
  const error = fields
    ? { code, fields, message }
    : { code, message }
  const body: ApiFailure = { error, ok: false }

  return applyResponseHeaders(Response.json(body, { status }), headers)
}

function isApplicationJson(request: Request) {
  const contentType = request.headers.get("content-type")

  return contentType?.split(";", 1)[0]?.trim().toLowerCase() === "application/json"
}

function hasAllowedOrigin(request: Request) {
  // Fetch Metadata is browser-controlled; do not accept cross-site requests even
  // when the Origin header is missing. Non-browser JSON clients may omit Origin.
  if (request.headers.get("sec-fetch-site") === "cross-site") return false
  const origin = request.headers.get("origin")
  if (origin === null) return true

  const configured = (process.env.TRUSTED_APP_ORIGINS ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean)
  const deploymentOrigins = [
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
  ].filter((value): value is string => Boolean(value))
    .map((host) => `https://${host}`)
  const origins = [...configured, ...deploymentOrigins]
  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:3000", "http://127.0.0.1:3000")
  }
  const allowedOrigins = new Set(origins.map((value) => {
    try {
      const url = new URL(value)
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password
        || url.pathname !== "/" || url.search || url.hash) throw new Error()
      return url.origin
    } catch {
      throw new ApiError(503, "API_ORIGIN_MISCONFIGURED", "Request origin protection is not configured correctly.")
    }
  }))

  // Never derive trust from Host, forwarded headers, or the request URL.
  try {
    const parsed = new URL(origin)
    return origin === parsed.origin && allowedOrigins.has(origin)
  } catch {
    return false
  }
}

function getMaximumBodySize(value?: number) {
  if (value === undefined) return defaultMaxJsonBytes

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("maxBytes must be a positive safe integer.")
  }

  return value
}

async function readJsonBody(request: Request, maxBytes: number) {
  const tooLarge = () => new ApiError(413, "PAYLOAD_TOO_LARGE", "The request body is too large.")
  const declaredLength = request.headers.get("content-length")
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) {
      void request.body?.cancel().catch(() => undefined)
      throw new ApiError(400, "INVALID_CONTENT_LENGTH", "Content-Length must be a non-negative byte count.")
    }
    if (Number(declaredLength) > maxBytes) {
      void request.body?.cancel().catch(() => undefined)
      throw tooLarge()
    }
  }

  if (!request.body) {
    throw new ApiError(400, "INVALID_JSON", "A JSON request body is required.")
  }

  const reader = request.body.getReader()
  const decoder = new TextDecoder("utf-8", { fatal: true })
  const parts: string[] = []
  let byteLength = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteLength += value.byteLength
      // Enforce actual bytes even without, or with an understated, Content-Length.
      if (byteLength > maxBytes) throw tooLarge()
      parts.push(decoder.decode(value, { stream: true }))
    }
    if (byteLength === 0) {
      throw new ApiError(400, "INVALID_JSON", "A JSON request body is required.")
    }
    parts.push(decoder.decode())
    return JSON.parse(parts.join("")) as unknown
  } catch (error) {
    // Do not wait for an untrusted stream's cancellation callback to finish.
    void reader.cancel().catch(() => undefined)
    if (error instanceof ApiError) throw error
    throw new ApiError(400, "INVALID_JSON", "The request body is not valid JSON.")
  } finally {
    reader.releaseLock()
  }
}

function getFieldErrors(error: z.ZodError): ApiFieldErrors | undefined {
  const fieldErrors: ApiFieldErrors = {}

  error.issues.forEach((issue) => {
    const field = issue.path[0]

    if (typeof field !== "string") return

    fieldErrors[field] ??= []
    fieldErrors[field].push(issue.message)
  })

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined
}

export async function handleJsonPost<
  TSchema extends z.ZodType,
  TData,
>(
  request: Request,
  schema: TSchema,
  handler: (
    input: z.output<TSchema>,
  ) => Promise<JsonHandlerResult<TData>> | JsonHandlerResult<TData>,
  {
    maxBytes: configuredMaxBytes,
    requireSameOrigin = true,
    responseHeaders,
  }: HandleJsonPostOptions = {},
): Promise<Response> {
  try {
    if (requireSameOrigin && !hasAllowedOrigin(request)) {
      throw new ApiError(
        403,
        "ORIGIN_NOT_ALLOWED",
        "This request did not come from an allowed origin.",
      )
    }

    if (!isApplicationJson(request)) {
      throw new ApiError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Content-Type must be application/json.",
      )
    }

    const maxBytes = getMaximumBodySize(configuredMaxBytes)
    const body = await readJsonBody(request, maxBytes)
    const validation = await schema.safeParseAsync(body)

    if (!validation.success) {
      throw new ApiError(
        422,
        "VALIDATION_ERROR",
        validation.error.issues[0]?.message ??
          "Check the request fields and try again.",
        getFieldErrors(validation.error),
      )
    }

    const result = await handler(validation.data)

    return jsonSuccess(result.data, {
      headers: responseHeaders,
      message: result.message,
      status: result.status,
    })
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(
        error.status,
        error.code,
        error.message,
        error.fields,
        responseHeaders,
      )
    }

    console.error("Unexpected JSON API error", error)

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "Something went wrong. Please try again.",
      undefined,
      responseHeaders,
    )
  }
}
