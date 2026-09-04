import type { Metadata } from "next"

import { InstagramSetupRequired } from "@/features/instagram/instagram-setup-required"
import { InstagramWorkspace } from "@/features/instagram/instagram-workspace"
import {
  getInstagramWorkspace,
  InstagramSetupRequiredError,
} from "@/features/instagram/server/get-instagram"

export const metadata: Metadata = { title: "Instagram" }

export default async function InstagramPage() {
  let data: Awaited<ReturnType<typeof getInstagramWorkspace>>
  try {
    data = await getInstagramWorkspace()
  } catch (error) {
    if (error instanceof InstagramSetupRequiredError) return <InstagramSetupRequired />
    throw error
  }
  return <InstagramWorkspace data={data} />
}
