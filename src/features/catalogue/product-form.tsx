"use client"

import { type ChangeEvent, type FormEvent, useMemo, useState } from "react"
import { ImagePlus, LoaderCircle, Plus, Save, Trash2, Upload, Video } from "lucide-react"
import { toast } from "sonner"

import { Button, ButtonLink } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { postJson } from "@/lib/api/client"
import { createClient } from "@/lib/supabase/client"
import type { MediaMutationData, MediaUploadData, SaveProductData } from "./api-types"
import { catalogueProductSchema, type CatalogueProductInput } from "./schemas"
import type { CatalogueCategory, ProductEditorData } from "./types"
import { ProductMediaManager } from "./product-media-manager"

type FormVariant = {
  attributes: string
  costPrice: string
  id: string
  image: File | null
  isActive: boolean
  lowStockThreshold: string
  name: string
  sellingPrice: string
  sku: string
  stockQuantity: string
}

type FormValues = {
  categoryId: string
  costPrice: string
  description: string
  discountPrice: string
  lowStockThreshold: string
  name: string
  sellingPrice: string
  sku: string
  status: "active" | "archived" | "draft"
  stockQuantity: string
  subcategoryId: string
  tags: string
  trackInventory: boolean
}

function numberValue(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function parseAttributes(value: string) {
  return value.split(",").map((part) => part.trim()).filter(Boolean).map((part) => {
    const [name = "", ...valueParts] = part.split(":")
    return { name: name.trim(), value: valueParts.join(":").trim() }
  })
}

function attributesText(attributes: Array<{ name: string; value: string }>) {
  return attributes.map((attribute) => `${attribute.name}: ${attribute.value}`).join(", ")
}

function defaultVariant(sellingPrice: string, costPrice: string): FormVariant {
  return {
    attributes: "",
    costPrice,
    id: crypto.randomUUID(),
    image: null,
    isActive: true,
    lowStockThreshold: "0",
    name: "",
    sellingPrice,
    sku: "",
    stockQuantity: "0",
  }
}

function initialFormState(initial: ProductEditorData | null, categories: CatalogueCategory[]) {
  const selectedCategory = initial?.categoryId
    ? categories.find((category) => category.id === initial.categoryId)
    : null
  const categoryId = selectedCategory?.parentId ?? selectedCategory?.id ?? ""
  const subcategoryId = selectedCategory?.parentId ? selectedCategory.id : ""

  return {
    values: {
      categoryId,
      costPrice: String(initial?.costPrice ?? 0),
      description: initial?.description ?? "",
      discountPrice: initial?.discountPrice === null || initial?.discountPrice === undefined
        ? ""
        : String(initial.discountPrice),
      lowStockThreshold: String(initial?.lowStockThreshold ?? 0),
      name: initial?.name ?? "",
      sellingPrice: String(initial?.sellingPrice ?? 0),
      sku: initial?.sku ?? "",
      status: initial?.status ?? "draft",
      stockQuantity: String(initial?.stockQuantity ?? 0),
      subcategoryId,
      tags: initial?.tags.join(", ") ?? "",
      trackInventory: initial?.trackInventory ?? true,
    } satisfies FormValues,
    variants: initial?.variants.map((variant) => ({
      attributes: attributesText(variant.attributes),
      costPrice: String(variant.costPrice),
      id: variant.id,
      image: null,
      isActive: variant.isActive,
      lowStockThreshold: String(variant.lowStockThreshold),
      name: variant.name,
      sellingPrice: String(variant.sellingPrice),
      sku: variant.sku ?? "",
      stockQuantity: String(variant.stockQuantity),
    })) ?? [],
  }
}

export function ProductForm({
  categories,
  currencyCode,
  initialProduct,
}: {
  categories: CatalogueCategory[]
  currencyCode: string
  initialProduct: ProductEditorData | null
}) {
  const initialState = useMemo(
    () => initialFormState(initialProduct, categories),
    [categories, initialProduct],
  )
  const [values, setValues] = useState<FormValues>(initialState.values)
  const [variants, setVariants] = useState<FormVariant[]>(initialState.variants)
  const [images, setImages] = useState<File[]>([])
  const [videos, setVideos] = useState<File[]>([])
  const [mediaError, setMediaError] = useState("")
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [pending, setPending] = useState(false)
  const [uploadLabel, setUploadLabel] = useState("")

  const payload = useMemo<CatalogueProductInput>(() => {
    const mappedVariants = variants.map((variant) => ({
      attributes: parseAttributes(variant.attributes),
      costPrice: numberValue(variant.costPrice),
      id: variant.id,
      isActive: variant.isActive,
      lowStockThreshold: numberValue(variant.lowStockThreshold),
      name: variant.name,
      sellingPrice: numberValue(variant.sellingPrice),
      sku: variant.sku.trim() || null,
      stockQuantity: numberValue(variant.stockQuantity),
    }))
    const stockQuantity = mappedVariants.length
      ? mappedVariants.reduce((total, variant) => total + variant.stockQuantity, 0)
      : numberValue(values.stockQuantity)

    return {
      categoryId: values.subcategoryId || values.categoryId || null,
      costPrice: numberValue(values.costPrice),
      description: values.description.trim() || null,
      discountPrice: values.discountPrice === "" ? null : numberValue(values.discountPrice),
      lowStockThreshold: numberValue(values.lowStockThreshold),
      name: values.name,
      sellingPrice: numberValue(values.sellingPrice),
      sku: values.sku.trim() || null,
      status: values.status,
      stockQuantity,
      tags: [...new Set(values.tags.split(",").map((tag) => tag.trim()).filter(Boolean))],
      trackInventory: values.trackInventory,
      variants: mappedVariants,
    }
  }, [values, variants])
  const validation = useMemo(() => catalogueProductSchema.safeParse(payload), [payload])
  const rootCategories = categories.filter((category) => !category.parentId && category.isActive)
  const subcategories = categories.filter((category) =>
    category.parentId === values.categoryId && category.isActive,
  )

  function setField<Key extends keyof FormValues>(key: Key, value: FormValues[Key]) {
    setTouched((current) => ({ ...current, [key]: true }))
    setValues((current) => ({ ...current, [key]: value }))
  }

  function errorFor(field: string) {
    if (!touched[field] || validation.success) return undefined
    return validation.error.issues.find((issue) => issue.path[0] === field)?.message
  }

  function updateVariant(index: number, changes: Partial<FormVariant>) {
    setTouched((current) => ({ ...current, variants: true }))
    setVariants((current) => current.map((variant, variantIndex) =>
      variantIndex === index ? { ...variant, ...changes } : variant,
    ))
  }

  function chooseImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    const invalid = files.find((file) =>
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024,
    )
    if (invalid) {
      setMediaError("Images must be JPEG, PNG, or WebP files smaller than 5 MB each.")
      return
    }
    if (files.length + images.length + (initialProduct?.media.filter((item) => item.kind === "image" && !item.variantId).length ?? 0) > 12) {
      setMediaError("A product can have at most 12 product images.")
      return
    }
    setMediaError("")
    setImages((current) => [...current, ...files])
    event.currentTarget.value = ""
  }

  function chooseVideos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    const invalid = files.find((file) =>
      !["video/mp4", "video/webm", "video/quicktime"].includes(file.type) || file.size > 25 * 1024 * 1024,
    )
    if (invalid) {
      setMediaError("Videos must be MP4, WebM, or MOV files smaller than 25 MB each.")
      return
    }
    if (files.length + videos.length + (initialProduct?.media.filter((item) => item.kind === "video").length ?? 0) > 3) {
      setMediaError("A product can have at most 3 videos.")
      return
    }
    setMediaError("")
    setVideos((current) => [...current, ...files])
    event.currentTarget.value = ""
  }

  function chooseVariantImage(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null
    if (!file) {
      updateVariant(index, { image: null })
      return
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setMediaError("Variant images must be JPEG, PNG, or WebP files smaller than 5 MB.")
      event.currentTarget.value = ""
      return
    }
    setMediaError("")
    updateVariant(index, { image: file })
  }

  async function uploadMediaFiles(
    productId: string,
    mediaUploads: Array<{
      file: File
      kind: "image" | "video"
      position: number
      variantId: string | null
    }>,
  ) {
    setUploadLabel(`Preparing ${mediaUploads.length} media files…`)
    const preparation = await postJson<MediaUploadData>(
      `/api/catalogue/products/${productId}/media`,
      {
        operation: "prepare",
        payload: {
          files: mediaUploads.map((upload) => ({
            fileName: upload.file.name,
            fileSize: upload.file.size,
            kind: upload.kind,
            mimeType: upload.file.type,
          })),
        },
      },
    )
    if (!preparation.ok) throw new Error(preparation.error.message)
    if (preparation.data.uploads.length !== mediaUploads.length) {
      throw new Error("The server returned an incomplete media upload response.")
    }

    const supabase = createClient()
    const successfulIndexes: number[] = []
    let completedCount = 0
    const concurrency = 4

    for (let offset = 0; offset < mediaUploads.length; offset += concurrency) {
      const chunk = mediaUploads.slice(offset, offset + concurrency)
      const chunkResults = await Promise.all(chunk.map(async (upload, chunkIndex) => {
        const index = offset + chunkIndex
        const preparedUpload = preparation.data.uploads[index]
        if (!preparedUpload) return { index, succeeded: false }

        const result = await supabase.storage.from("product-media")
          .uploadToSignedUrl(preparedUpload.path, preparedUpload.token, upload.file, {
            contentType: upload.file.type,
          })
        completedCount += 1
        setUploadLabel(`Uploading media ${completedCount} of ${mediaUploads.length}…`)
        return { index, succeeded: !result.error }
      }))

      successfulIndexes.push(
        ...chunkResults.filter((result) => result.succeeded).map((result) => result.index),
      )
    }

    if (successfulIndexes.length) {
      setUploadLabel(`Saving ${successfulIndexes.length} media files…`)
      const finalizeResult = await postJson<MediaMutationData>(
        `/api/catalogue/products/${productId}/media`,
        {
          operation: "finalize",
          payload: {
            items: successfulIndexes.map((index) => {
              const upload = mediaUploads[index]!
              const preparedUpload = preparation.data.uploads[index]!
              return {
                fileName: upload.file.name,
                fileSize: upload.file.size,
                kind: upload.kind,
                mimeType: upload.file.type,
                position: upload.position,
                storagePath: preparedUpload.path,
                variantId: upload.variantId,
              }
            }),
          },
        },
      )
      if (!finalizeResult.ok) throw new Error(finalizeResult.error.message)
      toast.success(finalizeResult.message ?? "Product media uploaded.")
    }

    const failedCount = mediaUploads.length - successfulIndexes.length
    if (failedCount) {
      throw new Error(`${failedCount} media ${failedCount === 1 ? "file" : "files"} could not be uploaded.`)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !validation.success || mediaError) {
      setTouched({
        costPrice: true,
        discountPrice: true,
        lowStockThreshold: true,
        name: true,
        sellingPrice: true,
        stockQuantity: true,
        variants: true,
      })
      return
    }

    setPending(true)
    const response = await postJson<SaveProductData>(
      initialProduct ? `/api/catalogue/products/${initialProduct.id}` : "/api/catalogue/products",
      validation.data,
    )
    if (!response.ok) {
      setPending(false)
      toast.error(response.error.message)
      return
    }
    toast.success(response.message ?? "Product saved.")

    const mediaUploads = [
      ...images.map((file, index) => ({ file, kind: "image" as const, position: (initialProduct?.media.length ?? 0) + index, variantId: null })),
      ...videos.map((file, index) => ({ file, kind: "video" as const, position: (initialProduct?.media.length ?? 0) + images.length + index, variantId: null })),
      ...variants.filter((variant) => variant.image).map((variant, index) => ({ file: variant.image!, kind: "image" as const, position: (initialProduct?.media.length ?? 0) + images.length + videos.length + index, variantId: variant.id })),
    ]

    try {
      if (mediaUploads.length) {
        await uploadMediaFiles(response.data.productId, mediaUploads)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Some product media could not be uploaded.")
    }

    window.location.replace(response.data.redirectTo)
  }

  const variantError = errorFor("variants")

  return (
    <form className="grid gap-6" noValidate onSubmit={submit}>
      <Card>
        <CardHeader><CardTitle as="h2">Product information</CardTitle></CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium md:col-span-2">Product name<Input aria-invalid={Boolean(errorFor("name")) || undefined} className="h-11" maxLength={160} onChange={(event) => setField("name", event.currentTarget.value)} placeholder="e.g. Classic cotton t-shirt" value={values.name} />{errorFor("name") ? <span className="text-xs text-destructive">{errorFor("name")}</span> : null}</label>
            <label className="grid gap-2 text-sm font-medium">Category<select className="h-11 rounded-lg border border-input bg-background px-3 text-sm" onChange={(event) => { setField("categoryId", event.currentTarget.value); setField("subcategoryId", "") }} value={values.categoryId}><option value="">Uncategorised</option>{rootCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-medium">Subcategory<select className="h-11 rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50" disabled={!values.categoryId || !subcategories.length} onChange={(event) => setField("subcategoryId", event.currentTarget.value)} value={values.subcategoryId}><option value="">None</option>{subcategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-medium">SKU <span className="font-normal text-muted-foreground">(optional)</span><Input className="h-11" maxLength={80} onChange={(event) => setField("sku", event.currentTarget.value)} placeholder="TSHIRT-001" value={values.sku} /></label>
            <label className="grid gap-2 text-sm font-medium">Status<select className="h-11 rounded-lg border border-input bg-background px-3 text-sm" onChange={(event) => setField("status", event.currentTarget.value as FormValues["status"])} value={values.status}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
            <label className="grid gap-2 text-sm font-medium md:col-span-2">Description <span className="font-normal text-muted-foreground">(optional)</span><Textarea maxLength={5000} onChange={(event) => setField("description", event.currentTarget.value)} placeholder="Describe the product, materials, features, or use." rows={5} value={values.description} /></label>
            <label className="grid gap-2 text-sm font-medium md:col-span-2">Product tags <span className="font-normal text-muted-foreground">(optional)</span><Input className="h-11" onChange={(event) => setField("tags", event.currentTarget.value)} placeholder="new arrival, cotton, unisex" value={values.tags} /><span className="text-xs font-normal text-muted-foreground">Separate tags with commas.</span></label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle as="h2">Pricing and inventory</CardTitle></CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium">Cost price ({currencyCode})<Input aria-invalid={Boolean(errorFor("costPrice")) || undefined} inputMode="decimal" min="0" onChange={(event) => setField("costPrice", event.currentTarget.value)} step="0.01" type="number" value={values.costPrice} /></label>
          <label className="grid gap-2 text-sm font-medium">Selling price ({currencyCode})<Input aria-invalid={Boolean(errorFor("sellingPrice")) || undefined} inputMode="decimal" min="0" onChange={(event) => setField("sellingPrice", event.currentTarget.value)} step="0.01" type="number" value={values.sellingPrice} />{errorFor("sellingPrice") ? <span className="text-xs text-destructive">{errorFor("sellingPrice")}</span> : null}</label>
          <label className="grid gap-2 text-sm font-medium">Discount price <span className="font-normal text-muted-foreground">(optional)</span><Input aria-invalid={Boolean(errorFor("discountPrice")) || undefined} inputMode="decimal" min="0" onChange={(event) => setField("discountPrice", event.currentTarget.value)} placeholder="No discount" step="0.01" type="number" value={values.discountPrice} />{errorFor("discountPrice") ? <span className="text-xs text-destructive">{errorFor("discountPrice")}</span> : null}</label>
          <label className="grid gap-2 text-sm font-medium">Low-stock threshold<Input inputMode="decimal" min="0" onChange={(event) => setField("lowStockThreshold", event.currentTarget.value)} step="0.001" type="number" value={values.lowStockThreshold} /></label>
          <label className="flex items-center gap-2 text-sm md:col-span-2 xl:col-span-4"><input checked={values.trackInventory} className="size-4 accent-primary" onChange={(event) => setField("trackInventory", event.currentTarget.checked)} type="checkbox" />Track inventory for this product</label>
          {values.trackInventory && !variants.length ? <label className="grid gap-2 text-sm font-medium">Stock quantity<Input aria-invalid={Boolean(errorFor("stockQuantity")) || undefined} inputMode="decimal" min="0" onChange={(event) => setField("stockQuantity", event.currentTarget.value)} step="0.001" type="number" value={values.stockQuantity} /></label> : null}
          {values.trackInventory && variants.length ? <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground md:col-span-2 xl:col-span-4">Total product stock is calculated from the variant quantities: <strong className="text-foreground">{Number.isFinite(payload.stockQuantity) ? payload.stockQuantity : 0}</strong></p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b"><div><CardTitle as="h2">Product variants</CardTitle><p className="mt-1 text-sm text-muted-foreground">Add combinations such as Size: Large, Colour: Black or Storage: 256GB.</p></div><Button onClick={() => setVariants((current) => [...current, defaultVariant(values.sellingPrice, values.costPrice)])} size="sm" type="button" variant="outline"><Plus aria-hidden="true" />Add variant</Button></CardHeader>
        <CardContent className="grid gap-4">
          {variants.length ? variants.map((variant, index) => (
            <section className="grid gap-4 rounded-xl border p-4" key={variant.id}>
              <div className="flex items-center justify-between"><h3 className="font-medium">Variant {index + 1}</h3><Button aria-label={`Remove variant ${index + 1}`} onClick={() => setVariants((current) => current.filter((item) => item.id !== variant.id))} size="icon-sm" type="button" variant="ghost"><Trash2 aria-hidden="true" /></Button></div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="grid gap-2 text-sm font-medium">Variant name<Input maxLength={120} onChange={(event) => updateVariant(index, { name: event.currentTarget.value })} placeholder="Large / Black" value={variant.name} /></label>
                <label className="grid gap-2 text-sm font-medium">Options<Input onChange={(event) => updateVariant(index, { attributes: event.currentTarget.value })} placeholder="Size: Large, Colour: Black" value={variant.attributes} /></label>
                <label className="grid gap-2 text-sm font-medium">SKU <span className="font-normal text-muted-foreground">(optional)</span><Input maxLength={80} onChange={(event) => updateVariant(index, { sku: event.currentTarget.value })} value={variant.sku} /></label>
                <label className="grid gap-2 text-sm font-medium">Selling price<Input min="0" onChange={(event) => updateVariant(index, { sellingPrice: event.currentTarget.value })} step="0.01" type="number" value={variant.sellingPrice} /></label>
                <label className="grid gap-2 text-sm font-medium">Cost price<Input min="0" onChange={(event) => updateVariant(index, { costPrice: event.currentTarget.value })} step="0.01" type="number" value={variant.costPrice} /></label>
                <label className="grid gap-2 text-sm font-medium">Stock quantity<Input min="0" onChange={(event) => updateVariant(index, { stockQuantity: event.currentTarget.value })} step="0.001" type="number" value={variant.stockQuantity} /></label>
                <label className="grid gap-2 text-sm font-medium">Low-stock threshold<Input min="0" onChange={(event) => updateVariant(index, { lowStockThreshold: event.currentTarget.value })} step="0.001" type="number" value={variant.lowStockThreshold} /></label>
                <label className="grid gap-2 text-sm font-medium">Variant image <span className="font-normal text-muted-foreground">(optional)</span><span className="flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-2.5 text-xs text-muted-foreground"><ImagePlus aria-hidden="true" className="size-4" /><span className="truncate">{variant.image?.name ?? "Choose image"}</span><input accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => chooseVariantImage(index, event)} type="file" /></span></label>
              </div>
            </section>
          )) : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No variants. The product price and stock will be used directly.</p>}
          {variantError ? <p className="text-xs text-destructive" role="alert">{variantError}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle as="h2">Product media</CardTitle><p className="text-sm text-muted-foreground">Upload multiple images and videos. Images support JPEG, PNG, and WebP; videos support MP4, WebM, and MOV.</p></CardHeader>
        <CardContent className="grid gap-5">
          {initialProduct ? <ProductMediaManager initialMedia={initialProduct.media} productId={initialProduct.id} /> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground hover:bg-muted/40"><Upload aria-hidden="true" className="size-5" /><span>{images.length ? `${images.length} new image${images.length === 1 ? "" : "s"} selected` : "Choose product images"}</span><input accept="image/jpeg,image/png,image/webp" className="sr-only" multiple onChange={chooseImages} type="file" /></label>
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground hover:bg-muted/40"><Video aria-hidden="true" className="size-5" /><span>{videos.length ? `${videos.length} new video${videos.length === 1 ? "" : "s"} selected` : "Choose product videos"}</span><input accept="video/mp4,video/webm,video/quicktime" className="sr-only" multiple onChange={chooseVideos} type="file" /></label>
          </div>
          {images.length || videos.length ? <div className="flex flex-wrap gap-2">{[...images, ...videos].map((file, index) => <span className="rounded-full bg-muted px-3 py-1 text-xs" key={`${file.name}:${index}`}>{file.name}</span>)}</div> : null}
          {mediaError ? <p className="text-xs text-destructive" role="alert">{mediaError}</p> : null}
        </CardContent>
      </Card>

      <div className="sticky bottom-16 z-10 flex items-center justify-end gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur md:bottom-3">
        <ButtonLink href={initialProduct ? `/app/catalogue/${initialProduct.id}` : "/app/catalogue"} variant="outline">Cancel</ButtonLink>
        <Button className="min-w-40" disabled={!validation.success || Boolean(mediaError) || pending} type="submit">
          {pending ? <><LoaderCircle aria-hidden="true" className="animate-spin" />{uploadLabel || "Saving product…"}</> : <><Save aria-hidden="true" />{initialProduct ? "Save changes" : "Create product"}</>}
        </Button>
      </div>
    </form>
  )
}
