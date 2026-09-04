import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { InstagramImportReview } from "@/features/instagram/instagram-import-review"
import { InstagramSetupRequired } from "@/features/instagram/instagram-setup-required"
import {
  getInstagramImportReview,
  InstagramSetupRequiredError,
} from "@/features/instagram/server/get-instagram"
import { ApiError } from "@/lib/api/server"

export const metadata: Metadata = { title: "Review Instagram import" }

export default async function InstagramImportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const validation = z.object({ id: z.uuid() }).safeParse(await params)
  if (!validation.success) notFound()

  let data: Awaited<ReturnType<typeof getInstagramImportReview>>
  try {
    data = await getInstagramImportReview(validation.data.id)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    if (error instanceof InstagramSetupRequiredError) return <InstagramSetupRequired />
    throw error
  }
  return <InstagramImportReview data={data} />
}
