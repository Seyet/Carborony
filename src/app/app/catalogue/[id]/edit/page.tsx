import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { CatalogueSetupRequired } from "@/features/catalogue/catalogue-setup-required"
import { ProductForm } from "@/features/catalogue/product-form"
import {
  CatalogueSetupRequiredError,
  getCatalogueOptions,
  getProductEditorData,
} from "@/features/catalogue/server/get-catalogue"
import { ApiError } from "@/lib/api/server"

export const metadata: Metadata = { title: "Edit product" }

type EditProductPageProps = {
  params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: EditProductPageProps) {
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
      <header className="flex items-start gap-3">
        <Button aria-label="Back to product details" render={<Link href={`/app/catalogue/${data.id}`} />} size="icon" variant="outline"><ArrowLeft aria-hidden="true" /></Button>
        <div><p className="text-xs text-muted-foreground">Catalogue / {data.name}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Edit product</h1><p className="mt-1 text-sm text-muted-foreground">Update product information, variants, stock, and media.</p></div>
      </header>
      <ProductForm categories={options.categories} currencyCode={options.currencyCode} initialProduct={data} />
    </div>
  )
}
