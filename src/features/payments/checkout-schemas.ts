import { z } from "zod"

export const paymentReferenceSchema = z.string().regex(/^CB-[a-f0-9]{32}$/)

export function paymentCallbackReference(
  reference: string | string[] | undefined,
  transactionReference: string | string[] | undefined,
) {
  const values = [reference, transactionReference].flatMap((value) =>
    value === undefined ? [] : Array.isArray(value) ? value : [value],
  )
  const candidate = values[0]
  if (!candidate || values.some((value) => value !== candidate)) return null
  return paymentReferenceSchema.safeParse(candidate).success ? candidate : null
}

export const paymentStatusSchema = z.object({
  reference: paymentReferenceSchema,
  slug: z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
})
