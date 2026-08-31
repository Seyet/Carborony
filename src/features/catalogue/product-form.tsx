"use client"

import { type ChangeEvent, type FormEvent, useMemo, useState } from "react"
import { ImagePlus, LoaderCircle, Plus, Save, Trash2, Upload, Video, X } from "lucide-react"
import { toast } from "sonner"

import { Button, ButtonLink } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { postJson } from "@/lib/api/client"
import { createClient } from "@/lib/supabase/client"
import type { MediaMutationData, MediaUploadData, SaveProductData } from "./api-types"
import { catalogueProductSchema, type CatalogueProductInput } from "./schemas"
import type { CatalogueCategory, ProductEditorData, ProductSpecification } from "./types"
import { ProductMediaManager } from "./product-media-manager"

type FormVariant = {
  attributes: Array<{ name: string; value: string }>
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

type FormOptionGroup = {
  id: string
  name: string
  values: string[]
}

const optionPresets = [
  { name: "Size", values: [] },
  { name: "Colour", values: [] },
  { name: "Length", values: [] },
  { name: "Material", values: [] },
  { name: "Storage", values: [] },
  { name: "Pack size", values: [] },
] as const

const sizeOptions = ["XXS", "XS", "Small", "Medium", "Large", "XL", "XXL", "3XL", "4XL", "One size"]
const colourOptions = [
  "Black",
  "White",
  "Grey",
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Purple",
  "Pink",
  "Brown",
  "Beige",
  "Gold",
  "Silver",
  "Multicolour",
]

type MeasurementUnit = "cm" | "in" | "m"

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

function defaultVariant(sellingPrice: string, costPrice: string): FormVariant {
  return {
    attributes: [],
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

function normalizedText(value: string) {
  return value.trim().toLocaleLowerCase()
}

function attributesKey(attributes: Array<{ name: string; value: string }>) {
  return attributes
    .map((attribute) => `${normalizedText(attribute.name)}:${normalizedText(attribute.value)}`)
    .sort()
    .join("|")
}

function optionGroupsFromVariants(variants: FormVariant[]): FormOptionGroup[] {
  const groups = new Map<string, FormOptionGroup>()
  variants.forEach((variant) => variant.attributes.forEach((attribute) => {
    const key = normalizedText(attribute.name)
    if (!key || !normalizedText(attribute.value)) return
    const group = groups.get(key) ?? {
      id: crypto.randomUUID(),
      name: attribute.name.trim(),
      values: [],
    }
    if (!group.values.some((value) => normalizedText(value) === normalizedText(attribute.value))) {
      group.values.push(attribute.value.trim())
    }
    groups.set(key, group)
  }))
  return [...groups.values()]
}

function variantName(attributes: Array<{ name: string; value: string }>) {
  return attributes.map((attribute) => attribute.value).join(" / ")
}

function allCombinations(groups: FormOptionGroup[]) {
  const usableGroups = groups.filter((group) => group.name.trim() && group.values.length)
  if (!usableGroups.length || usableGroups.length !== groups.length) return []
  return usableGroups.reduce<Array<Array<{ name: string; value: string }>>>(
    (combinations, group) => combinations.flatMap((combination) => group.values.map((value) => [
      ...combination,
      { name: group.name.trim(), value },
    ])),
    [[]],
  )
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
      attributes: variant.attributes,
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
    specifications: initial?.specifications ?? [] satisfies ProductSpecification[],
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
  const [optionGroups, setOptionGroups] = useState<FormOptionGroup[]>(() => optionGroupsFromVariants(initialState.variants))
  const [optionValueDrafts, setOptionValueDrafts] = useState<Record<string, string>>({})
  const [optionMeasurementUnits, setOptionMeasurementUnits] = useState<Record<string, MeasurementUnit>>({})
  const [specifications, setSpecifications] = useState<ProductSpecification[]>(initialState.specifications)
  const [hasOptions, setHasOptions] = useState(initialState.variants.length > 0)
  const [bulkStockQuantity, setBulkStockQuantity] = useState("")
  const [bulkSkuPrefix, setBulkSkuPrefix] = useState("")
  const [images, setImages] = useState<File[]>([])
  const [videos, setVideos] = useState<File[]>([])
  const [mediaError, setMediaError] = useState("")
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [pending, setPending] = useState(false)
  const [uploadLabel, setUploadLabel] = useState("")

  const payload = useMemo<CatalogueProductInput>(() => {
    const mappedVariants = variants.map((variant) => ({
      attributes: variant.attributes,
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
      specifications,
      status: values.status,
      stockQuantity,
      tags: [...new Set(values.tags.split(",").map((tag) => tag.trim()).filter(Boolean))],
      trackInventory: values.trackInventory,
      variants: mappedVariants,
    }
  }, [specifications, values, variants])
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

  function addOptionGroup(name = "", values: string[] = []) {
    const normalizedName = normalizedText(name)
    if (optionGroups.length >= 3) {
      toast.error("Use up to three option groups so the product stays easy to manage.")
      return
    }
    if (normalizedName && optionGroups.some((group) => normalizedText(group.name) === normalizedName)) {
      toast.error(`${name} has already been added.`)
      return
    }
    setOptionGroups((current) => [...current, { id: crypto.randomUUID(), name, values }])
  }

  function updateOptionGroup(id: string, changes: Partial<FormOptionGroup>) {
    setOptionGroups((current) => current.map((group) => group.id === id ? { ...group, ...changes } : group))
  }

  function addOptionValue(group: FormOptionGroup, selectedValue?: string) {
    const draftValue = selectedValue?.trim() || optionValueDrafts[group.id]?.trim() || ""
    const value = normalizedText(group.name) === "length" && draftValue
      ? `${draftValue} ${optionMeasurementUnits[group.id] ?? "cm"}`
      : draftValue
    if (!value || group.values.some((item) => normalizedText(item) === normalizedText(value))) return
    updateOptionGroup(group.id, { values: [...group.values, value] })
    setOptionValueDrafts((current) => ({ ...current, [group.id]: "" }))
  }

  function updateOptionValueDraft(groupId: string, value: string) {
    setOptionValueDrafts((current) => ({ ...current, [groupId]: value }))
  }

  function optionValueControl(group: FormOptionGroup) {
    const optionName = normalizedText(group.name)

    if (optionName === "size" || optionName === "colour" || optionName === "color") {
      const choices = optionName === "size" ? sizeOptions : colourOptions
      const availableChoices = choices.filter((choice) =>
        !group.values.some((value) => normalizedText(value) === normalizedText(choice)),
      )

      return (
        <select
          aria-label={`Add ${group.name || "option"} value`}
          className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm disabled:opacity-50"
          disabled={!availableChoices.length}
          onChange={(event) => {
            const selectedValue = event.currentTarget.value
            if (selectedValue) addOptionValue(group, selectedValue)
          }}
          value=""
        >
          <option value="">{availableChoices.length ? `Select ${optionName === "size" ? "a size" : "a colour"}` : "All options added"}</option>
          {availableChoices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
        </select>
      )
    }

    if (optionName === "length") {
      return (
        <>
          <Input
            aria-label="Length value"
            inputMode="decimal"
            min="0"
            onValueChange={(value) => updateOptionValueDraft(group.id, value)}
            placeholder="e.g. 50"
            step="any"
            type="number"
            value={optionValueDrafts[group.id] ?? ""}
          />
          <select
            aria-label="Length unit"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
            onChange={(event) => setOptionMeasurementUnits((current) => ({
              ...current,
              [group.id]: event.currentTarget.value as MeasurementUnit,
            }))}
            value={optionMeasurementUnits[group.id] ?? "cm"}
          >
            <option value="cm">cm</option>
            <option value="in">inches</option>
            <option value="m">metres</option>
          </select>
          <Button onClick={() => addOptionValue(group)} type="button" variant="outline">Add</Button>
        </>
      )
    }

    return (
      <>
        <Input
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              addOptionValue(group)
            }
          }}
          onValueChange={(value) => updateOptionValueDraft(group.id, value)}
          placeholder="Type a value and press Enter"
          value={optionValueDrafts[group.id] ?? ""}
        />
        <Button onClick={() => addOptionValue(group)} type="button" variant="outline">Add</Button>
      </>
    )
  }

  function generateVariants() {
    const combinations = allCombinations(optionGroups)
    if (!combinations.length || combinations.length > 100) return

    const existing = new Map(variants.map((variant) => [attributesKey(variant.attributes), variant]))
    const retainedKeys = new Set(combinations.map(attributesKey))
    const removedCount = variants.filter((variant) => !retainedKeys.has(attributesKey(variant.attributes))).length
    if (removedCount && !window.confirm(`Regenerating will remove ${removedCount} existing variant${removedCount === 1 ? "" : "s"} from this form. Continue?`)) return
    setTouched((current) => ({ ...current, variants: true }))
    setVariants(combinations.map((attributes) => {
      const prior = existing.get(attributesKey(attributes))
      return prior ?? {
        ...defaultVariant(values.sellingPrice, values.costPrice),
        attributes,
        name: variantName(attributes),
      }
    }))
  }

  function updateSpecification(index: number, changes: Partial<ProductSpecification>) {
    setTouched((current) => ({ ...current, specifications: true }))
    setSpecifications((current) => current.map((specification, specificationIndex) =>
      specificationIndex === index ? { ...specification, ...changes } : specification,
    ))
  }

  function setProductOptionMode(enabled: boolean) {
    if (!enabled && variants.length && !window.confirm("This will remove the product's variants when you save. Continue?")) return
    setHasOptions(enabled)
    if (!enabled) {
      setOptionGroups([])
      setVariants([])
    }
  }

  function applyProductDefaults() {
    setVariants((current) => current.map((variant) => ({
      ...variant,
      costPrice: values.costPrice,
      lowStockThreshold: values.lowStockThreshold,
      sellingPrice: values.sellingPrice,
    })))
  }

  function applyBulkStock() {
    if (!Number.isFinite(numberValue(bulkStockQuantity)) || numberValue(bulkStockQuantity) < 0) return
    setVariants((current) => current.map((variant) => ({ ...variant, stockQuantity: bulkStockQuantity })))
  }

  function applySkuPrefix() {
    const prefix = bulkSkuPrefix.trim()
    if (!prefix) return
    setVariants((current) => current.map((variant, index) => ({
      ...variant,
      sku: variant.sku || `${prefix}-${String(index + 1).padStart(3, "0")}`,
    })))
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
    if (hasOptions && !variants.length) {
      toast.error("Review the option combinations before saving this product.")
      return
    }
    if (pending || !validation.success || mediaError) {
      setTouched({
        costPrice: true,
        discountPrice: true,
        lowStockThreshold: true,
        name: true,
        sellingPrice: true,
        specifications: true,
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
  const specificationError = errorFor("specifications")
  const generatedCombinations = allCombinations(optionGroups)
  const duplicateOptionNames = optionGroups.some((group, index) => optionGroups.some((other, otherIndex) =>
    index !== otherIndex && normalizedText(group.name) && normalizedText(group.name) === normalizedText(other.name),
  ))
  const canGenerateVariants = !duplicateOptionNames && generatedCombinations.length > 0 && generatedCombinations.length <= 100

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
          {values.trackInventory && !hasOptions ? <label className="grid gap-2 text-sm font-medium">Stock quantity<Input aria-invalid={Boolean(errorFor("stockQuantity")) || undefined} inputMode="decimal" min="0" onChange={(event) => setField("stockQuantity", event.currentTarget.value)} step="0.001" type="number" value={values.stockQuantity} /></label> : null}
          {values.trackInventory && hasOptions ? <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground md:col-span-2 xl:col-span-4">{variants.length ? <>Total product stock is calculated from the variant quantities: <strong className="text-foreground">{Number.isFinite(payload.stockQuantity) ? payload.stockQuantity : 0}</strong></> : "Generate variants to set stock for each sellable combination."}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle as="h2">Product specifications</CardTitle><p className="text-sm text-muted-foreground">Add fixed details shared by every item, such as dimensions. These do not create separate stock records.</p></CardHeader>
        <CardContent className="grid gap-4">
          {specifications.map((specification, index) => (
            <div className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_100px_auto]" key={`${specification.name}:${index}`}>
              <label className="grid gap-1 text-sm font-medium">Specification<Input maxLength={50} onChange={(event) => updateSpecification(index, { name: event.currentTarget.value })} placeholder="e.g. Length" value={specification.name} /></label>
              <label className="grid gap-1 text-sm font-medium">Value<Input maxLength={120} onChange={(event) => updateSpecification(index, { value: event.currentTarget.value })} placeholder="e.g. 30" value={specification.value} /></label>
              <label className="grid gap-1 text-sm font-medium">Unit<select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" onChange={(event) => updateSpecification(index, { unit: event.currentTarget.value as ProductSpecification["unit"] })} value={specification.unit}><option value="">None</option><option value="cm">cm</option><option value="in">inches</option><option value="m">metres</option></select></label>
              <Button aria-label={`Remove specification ${index + 1}`} className="self-end" onClick={() => setSpecifications((current) => current.filter((_, itemIndex) => itemIndex !== index))} size="icon" type="button" variant="ghost"><Trash2 aria-hidden="true" /></Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2"><Button onClick={() => { setTouched((current) => ({ ...current, specifications: true })); setSpecifications((current) => [...current, { name: "Length", unit: "cm", value: "" }, { name: "Width", unit: "cm", value: "" }, { name: "Height", unit: "cm", value: "" }]) }} size="sm" type="button" variant="outline"><Plus aria-hidden="true" />Add dimensions</Button><Button onClick={() => { setTouched((current) => ({ ...current, specifications: true })); setSpecifications((current) => [...current, { name: "", unit: "", value: "" }]) }} size="sm" type="button" variant="outline"><Plus aria-hidden="true" />Add specification</Button></div>
          {specificationError ? <p className="text-xs text-destructive" role="alert">{specificationError}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b"><CardTitle as="h2">Selling options</CardTitle><p className="text-sm text-muted-foreground">Add choices customers can buy, then set price and stock for each combination.</p></CardHeader>
        <CardContent className="grid gap-5">
          <fieldset className="grid gap-3"><legend className="text-sm font-medium">Does this product have customer-selectable options?</legend><div className="grid gap-3 sm:grid-cols-2"><label className={`cursor-pointer rounded-xl border p-4 ${!hasOptions ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}><input checked={!hasOptions} className="sr-only" name="product-options" onChange={() => setProductOptionMode(false)} type="radio" /><strong className="block">No options</strong><span className="mt-1 block text-sm text-muted-foreground">Use one price and stock quantity for the product.</span></label><label className={`cursor-pointer rounded-xl border p-4 ${hasOptions ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}><input checked={hasOptions} className="sr-only" name="product-options" onChange={() => setProductOptionMode(true)} type="radio" /><strong className="block">This product has options</strong><span className="mt-1 block text-sm text-muted-foreground">For size, colour, length, storage, pack size, and more.</span></label></div></fieldset>

          {hasOptions ? <>
            <section className="grid gap-4 rounded-xl border bg-muted/20 p-4">
              <div><h3 className="font-medium">1. Add customer choices</h3><p className="mt-1 text-sm text-muted-foreground">Use a measurement option only when it changes what a customer buys, such as 1 m or 2 m.</p></div>
              <div className="flex flex-wrap gap-2">{optionPresets.map((preset) => <Button key={preset.name} onClick={() => addOptionGroup(preset.name, [...preset.values])} size="sm" type="button" variant="outline"><Plus aria-hidden="true" />{preset.name}</Button>)}<Button onClick={() => addOptionGroup()} size="sm" type="button" variant="outline"><Plus aria-hidden="true" />Custom</Button></div>
              {optionGroups.map((group, index) => <div className="grid gap-3 rounded-xl border bg-background p-3 lg:grid-cols-[200px_minmax(0,1fr)_auto]" key={group.id}><label className="grid gap-1 text-sm font-medium">Option name<Input maxLength={50} onChange={(event) => updateOptionGroup(group.id, { name: event.currentTarget.value })} placeholder="e.g. Material" value={group.name} /></label><div className="grid gap-2"><span className="text-sm font-medium">Values</span><div className="flex flex-wrap gap-2">{group.values.map((value) => <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-1 text-xs" key={value}>{value}<button aria-label={`Remove ${value}`} className="rounded-full text-muted-foreground hover:text-destructive" onClick={() => updateOptionGroup(group.id, { values: group.values.filter((item) => item !== value) })} type="button"><X aria-hidden="true" className="size-3" /></button></span>)}</div><div className="flex gap-2">{optionValueControl(group)}</div></div><Button aria-label={`Remove option ${index + 1}`} className="self-start lg:mt-6" onClick={() => setOptionGroups((current) => current.filter((item) => item.id !== group.id))} size="icon-sm" type="button" variant="ghost"><Trash2 aria-hidden="true" /></Button></div>)}
              {duplicateOptionNames ? <p className="text-xs text-destructive">Each option needs a unique name.</p> : null}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-sm text-muted-foreground">{generatedCombinations.length ? `${generatedCombinations.length} sellable combination${generatedCombinations.length === 1 ? "" : "s"} ready to review.` : "Add a name and at least one value to every option."}{generatedCombinations.length > 100 ? " Keep the product to 100 combinations or fewer." : ""}</p><Button disabled={!canGenerateVariants} onClick={generateVariants} type="button"><Plus aria-hidden="true" />Review variants</Button></div>
            </section>

            {variants.length ? <section className="grid gap-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-medium">2. Set up sellable variants</h3><p className="mt-1 text-sm text-muted-foreground">Names and options are created automatically. Override price, stock, SKU, availability, or image where needed.</p></div><Button onClick={applyProductDefaults} size="sm" type="button" variant="outline">Use product price and cost</Button></div><div className="grid gap-3 rounded-xl border bg-muted/20 p-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]"><label className="grid gap-1 text-sm font-medium">Set stock for all<Input min="0" onChange={(event) => setBulkStockQuantity(event.currentTarget.value)} placeholder="e.g. 10" step="0.001" type="number" value={bulkStockQuantity} /></label><Button className="self-end" disabled={!bulkStockQuantity} onClick={applyBulkStock} type="button" variant="outline">Apply stock</Button><label className="grid gap-1 text-sm font-medium">SKU prefix for empty SKUs<Input maxLength={70} onChange={(event) => setBulkSkuPrefix(event.currentTarget.value)} placeholder="e.g. TSHIRT" value={bulkSkuPrefix} /></label><Button className="self-end" disabled={!bulkSkuPrefix.trim()} onClick={applySkuPrefix} type="button" variant="outline">Apply SKUs</Button></div>
              {variants.map((variant, index) => <section className="grid gap-4 rounded-xl border p-4" key={variant.id}><div className="flex items-center justify-between gap-3"><div><h4 className="font-medium">{variant.name || `Variant ${index + 1}`}</h4><div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">{variant.attributes.map((attribute) => <span className="rounded bg-muted px-1.5 py-0.5" key={`${attribute.name}:${attribute.value}`}>{attribute.name}: {attribute.value}</span>)}</div></div><label className="flex items-center gap-2 text-sm"><input checked={variant.isActive} className="size-4 accent-primary" onChange={(event) => updateVariant(index, { isActive: event.currentTarget.checked })} type="checkbox" />Available</label></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{variant.attributes.length ? null : <label className="grid gap-2 text-sm font-medium">Variant name<Input maxLength={120} onChange={(event) => updateVariant(index, { name: event.currentTarget.value })} value={variant.name} /></label>}<label className="grid gap-2 text-sm font-medium">SKU <span className="font-normal text-muted-foreground">(optional)</span><Input maxLength={80} onChange={(event) => updateVariant(index, { sku: event.currentTarget.value })} value={variant.sku} /></label><label className="grid gap-2 text-sm font-medium">Selling price<Input min="0" onChange={(event) => updateVariant(index, { sellingPrice: event.currentTarget.value })} step="0.01" type="number" value={variant.sellingPrice} /></label><label className="grid gap-2 text-sm font-medium">Cost price<Input min="0" onChange={(event) => updateVariant(index, { costPrice: event.currentTarget.value })} step="0.01" type="number" value={variant.costPrice} /></label><label className="grid gap-2 text-sm font-medium">Stock quantity<Input min="0" onChange={(event) => updateVariant(index, { stockQuantity: event.currentTarget.value })} step="0.001" type="number" value={variant.stockQuantity} /></label><label className="grid gap-2 text-sm font-medium">Low-stock threshold<Input min="0" onChange={(event) => updateVariant(index, { lowStockThreshold: event.currentTarget.value })} step="0.001" type="number" value={variant.lowStockThreshold} /></label><label className="grid gap-2 text-sm font-medium">Variant image <span className="font-normal text-muted-foreground">(optional)</span><span className="flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-2.5 text-xs text-muted-foreground"><ImagePlus aria-hidden="true" className="size-4" /><span className="truncate">{variant.image?.name ?? "Choose image"}</span><input accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => chooseVariantImage(index, event)} type="file" /></span></label></div></section>)}
            </section> : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Add choices, then select Review variants to create the sellable combinations.</p>}
          </> : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Customers will buy this as one product using the price and stock entered above.</p>}
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
