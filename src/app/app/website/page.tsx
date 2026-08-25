import type { Metadata } from "next"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { StorefrontOverview } from "@/features/storefront/storefront-overview"

export const metadata: Metadata = {
  description: "Build and manage your Carborony online storefront.",
  title: "My Website",
}

export default async function WebsitePage() {
  const business = await getCurrentBusiness()

  return <StorefrontOverview businessName={business.name} />
}
