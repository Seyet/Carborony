import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft, Pencil } from "lucide-react"
import { z } from "zod"

import { ButtonLink } from "@/components/ui/button"
import { CatalogueSetupRequired } from "@/features/catalogue/catalogue-setup-required"
import { ProductDetails } from "@/features/catalogue/product-details"
import {
  CatalogueSetupRequiredError,
  getCatalogueOptions,
  getProductEditorData,
} from "@/features/catalogue/server/get-catalogue"
import { ApiError } from "@/lib/api/server"

export const metadata: Metadata = { title: "Product details" }

type ProductDetailsPageProps = {
  params: Promise<{ id: string }>
}

export default async function ProductDetailsPage({ params }: ProductDetailsPageProps) {
  const validation = z.object({ id: z.uuid() }).safeParse(await params)
  if (!validation.success) notFound()

  let data: Awaited<ReturnType<typeof getProductEditorData>> | null = null
  let options: Awaited<ReturnType<typeof getCatalogueOptions>> | null = null
  try {
    const results = await Promise.all([
      getProductEditorData(validation.data.id),
      getCatalogueOptions(),
    ])
    data = results[0]
    options = results[1]
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    if (!(error instanceof CatalogueSetupRequiredError)) throw error
  }

  if (!data || !options) return <CatalogueSetupRequired />

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <ButtonLink
            aria-label="Back to catalogue"
            href="/app/catalogue"
            size="icon"
            variant="outline"
          >
            <ArrowLeft aria-hidden="true" />
          </ButtonLink>
          <div>
            <p className="text-xs text-muted-foreground">Catalogue / {data.name}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Product details</h1>
            <p className="mt-1 text-sm text-muted-foreground">View pricing, inventory, variants, and product media.</p>
          </div>
        </div>
        <ButtonLink href={`/app/catalogue/${data.id}/edit`} variant="outline">
          <Pencil aria-hidden="true" />Edit product
        </ButtonLink>
      </header>
      <ProductDetails categories={options.categories} currencyCode={options.currencyCode} product={data} />
    </div>
  )
}
