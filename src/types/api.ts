export type ApiFieldErrors = Record<string, string[]>

export type ApiSuccess<TData> = {
  ok: true
  data: TData
  message?: string
}

export type ApiFailure<TCode extends string = string> = {
  ok: false
  error: {
    code: TCode
    message: string
    fields?: ApiFieldErrors
  }
}

export type ApiResponse<
  TData,
  TCode extends string = string,
> = ApiSuccess<TData> | ApiFailure<TCode>
