import type { Metadata } from "next"
import { ArrowLeft } from "lucide-react"

import { ButtonLink } from "@/components/ui/button"
import { CatalogueSetupRequired } from "@/features/catalogue/catalogue-setup-required"
import { ProductForm } from "@/features/catalogue/product-form"
import {
  CatalogueSetupRequiredError,
  getCatalogueOptions,
} from "@/features/catalogue/server/get-catalogue"

export const metadata: Metadata = { title: "Add product" }

export default async function NewProductPage() {
  let options: Awaited<ReturnType<typeof getCatalogueOptions>> | null = null
  try {
    options = await getCatalogueOptions()
  } catch (error) {
    if (!(error instanceof CatalogueSetupRequiredError)) throw error
  }

  if (!options) return <CatalogueSetupRequired />

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <ButtonLink aria-label="Back to catalogue" href="/app/catalogue" size="icon" variant="outline"><ArrowLeft aria-hidden="true" /></ButtonLink>
        <div><p className="text-xs text-muted-foreground">Catalogue / New product</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Add product</h1><p className="mt-1 text-sm text-muted-foreground">Create the product, its stock, variants, images, and videos.</p></div>
      </header>
      <ProductForm categories={options.categories} currencyCode={options.currencyCode} initialProduct={null} />
    </div>
  )
}
