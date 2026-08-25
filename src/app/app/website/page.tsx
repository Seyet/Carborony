import type { Metadata } from "next"

import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StorefrontSetupRequiredError, getStorefrontAdminData } from "@/features/storefront/server/get-storefront-admin"
import { StorefrontOverview } from "@/features/storefront/storefront-overview"

export const metadata: Metadata = {
  description: "Build and manage your Carborony online storefront.",
  title: "My Website",
}

export default async function WebsitePage() {
  await getCurrentBusiness()
  let data: Awaited<ReturnType<typeof getStorefrontAdminData>>
  try {
    data = await getStorefrontAdminData()
  } catch (error) {
    if (error instanceof StorefrontSetupRequiredError) {
      return <Card className="mx-auto mt-16 max-w-xl"><CardHeader><CardTitle as="h1">Storefront setup required</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Apply the latest Supabase storefront migration to configure and publish your website.</CardContent></Card>
    }
    throw error
  }
  return <StorefrontOverview data={data} />
}
