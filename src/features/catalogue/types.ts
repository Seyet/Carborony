export type CatalogueCategory = {
  description: string | null
  id: string
  isActive: boolean
  name: string
  parentId: string | null
  position: number
}

export type CatalogueListItem = {
  categoryId: string | null
  categoryName: string | null
  discountPrice: number | null
  id: string
  imageUrl: string | null
  lowStockThreshold: number
  name: string
  sellingPrice: number
  sku: string | null
  status: string
  stockQuantity: number | null
  variantCount: number
}

export type CatalogueResult = {
  categories: CatalogueCategory[]
  currencyCode: string
  items: CatalogueListItem[]
  page: number
  pageCount: number
  totalCount: number
}

export type ProductMediaItem = {
  fileName: string
  id: string
  isPrimary: boolean
  kind: "image" | "video"
  position: number
  publicUrl: string
  storagePath: string
  variantId: string | null
  variantName: string | null
}

export type ProductEditorVariant = {
  attributes: Array<{ name: string; value: string }>
  costPrice: number
  id: string
  isActive: boolean
  lowStockThreshold: number
  name: string
  sellingPrice: number
  sku: string | null
  stockQuantity: number
}

export type ProductEditorData = {
  categoryId: string | null
  costPrice: number
  description: string | null
  discountPrice: number | null
  id: string
  lowStockThreshold: number
  media: ProductMediaItem[]
  name: string
  sellingPrice: number
  sku: string | null
  status: "active" | "archived" | "draft"
  stockQuantity: number
  tags: string[]
  trackInventory: boolean
  variants: ProductEditorVariant[]
}
