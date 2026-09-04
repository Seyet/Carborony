import "server-only"

import { randomUUID } from "node:crypto"

type LogValue = boolean | number | string | null | undefined
type InstagramLogContext = Record<string, LogValue>

function cleanContext(context: InstagramLogContext) {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined),
  )
}

function errorRecord(error: unknown) {
  return typeof error === "object" && error !== null
    ? error as Record<string, unknown>
    : null
}

function safeString(value: unknown, maximumLength = 120) {
  return typeof value === "string" && value.length > 0
    ? value.slice(0, maximumLength)
    : undefined
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined
}

/**
 * Return only diagnostic fields that cannot contain OAuth codes, access tokens,
 * captions, media URLs, request bodies, or secrets.
 */
export function safeInstagramError(error: unknown): InstagramLogContext {
  const record = errorRecord(error)
  const cause = errorRecord(record?.cause)

  return cleanContext({
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorCode: safeString(record?.code),
    errorStatus: safeNumber(record?.status),
    metaCode: safeNumber(record?.metaCode),
    metaRequestId: safeString(record?.metaRequestId),
    metaSubcode: safeNumber(record?.metaSubcode),
    metaTraceId: safeString(record?.metaTraceId),
    causeName: safeString(cause?.name),
    causeCode: safeString(cause?.code),
  })
}

export function newInstagramTraceId() {
  return randomUUID()
}

function writeInstagramLog(
  level: "error" | "info" | "warn",
  event: string,
  context: InstagramLogContext = {},
) {
  const payload = JSON.stringify({
    component: "instagram_integration",
    event,
    ...cleanContext(context),
  })

  console[level](payload)
}

export function logInstagramInfo(event: string, context?: InstagramLogContext) {
  writeInstagramLog("info", event, context)
}

export function logInstagramWarning(event: string, context?: InstagramLogContext) {
  writeInstagramLog("warn", event, context)
}

export function logInstagramError(
  event: string,
  error: unknown,
  context: InstagramLogContext = {},
) {
  writeInstagramLog("error", event, {
    ...context,
    ...safeInstagramError(error),
  })
}
