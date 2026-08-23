import type {
  ApiFailure,
  ApiFieldErrors,
  ApiResponse,
} from "@/types/api"

export type PostJsonOptions = {
  signal?: AbortSignal
}

function clientError(code: string, message: string): ApiFailure {
  return { error: { code, message }, ok: false }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFieldErrors(value: unknown): value is ApiFieldErrors {
  if (!isRecord(value)) return false

  return Object.values(value).every(
    (messages) =>
      Array.isArray(messages) &&
      messages.every((message) => typeof message === "string"),
  )
}

function isApiResponse<TData>(value: unknown): value is ApiResponse<TData> {
  if (!isRecord(value) || typeof value.ok !== "boolean") return false

  if (value.ok) {
    return (
      Object.prototype.hasOwnProperty.call(value, "data") &&
      (value.message === undefined || typeof value.message === "string")
    )
  }

  if (!isRecord(value.error)) return false

  return (
    typeof value.error.code === "string" &&
    typeof value.error.message === "string" &&
    (value.error.fields === undefined || isFieldErrors(value.error.fields))
  )
}

function isJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type")
  const mediaType = contentType?.split(";", 1)[0]?.trim().toLowerCase()

  return mediaType === "application/json" || mediaType?.endsWith("+json")
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

export async function postJson<TResponse, TBody = unknown>(
  url: string,
  body: TBody,
  { signal }: PostJsonOptions = {},
): Promise<ApiResponse<TResponse>> {
  let serializedBody: string

  try {
    const serialized = JSON.stringify(body)

    if (serialized === undefined) {
      return clientError(
        "INVALID_REQUEST_BODY",
        "The request could not be prepared. Please try again.",
      )
    }

    serializedBody = serialized
  } catch {
    return clientError(
      "INVALID_REQUEST_BODY",
      "The request could not be prepared. Please try again.",
    )
  }

  try {
    const response = await fetch(url, {
      body: serializedBody,
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
      signal,
    })

    if (!isJsonResponse(response)) {
      return clientError(
        "INVALID_RESPONSE",
        "The server returned an invalid response. Please try again.",
      )
    }

    let payload: unknown

    try {
      payload = await response.json()
    } catch {
      return clientError(
        "INVALID_RESPONSE",
        "The server returned an invalid response. Please try again.",
      )
    }

    if (!isApiResponse<TResponse>(payload) || response.ok !== payload.ok) {
      return clientError(
        "INVALID_RESPONSE",
        "The server returned an invalid response. Please try again.",
      )
    }

    return payload
  } catch (error) {
    if (isAbortError(error)) {
      return clientError("REQUEST_ABORTED", "The request was cancelled.")
    }

    return clientError(
      "NETWORK_ERROR",
      "We couldn't reach the server. Check your connection and try again.",
    )
  }
}
