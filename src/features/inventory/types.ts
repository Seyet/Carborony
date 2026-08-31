export type InventoryMetrics = {
  inventoryValue: number
  lowStockCount: number
  outOfStockCount: number
  totalProducts: number
  totalUnits: number
}

export type InventoryProduct = {
  categoryName: string | null
  costPrice: number
  id: string
  imageUrl: string | null
  inventoryValue: number
  lowStockThreshold: number
  name: string
  sku: string | null
  status: string
  stockQuantity: number
  trackInventory: boolean
  variants: Array<{
    attributes: Array<{ name: string; value: string }>
    id: string
    imageUrl: string | null
    name: string
    sku: string | null
    stockQuantity: number
  }>
}

export type InventoryMovement = {
  createdByName: string
  id: string
  locationName: string
  movementType: string
  note: string | null
  occurredAt: string
  productId: string
  productName: string
  productSku: string | null
  quantityDelta: number
  unitCost: number | null
  variantName: string | null
}

export type InventoryPageData = {
  currencyCode: string
  items: InventoryProduct[]
  metrics: InventoryMetrics
  movements: InventoryMovement[]
  page: number
  pageCount: number
  timezone: string
  totalCount: number
}

export type InventoryView = "history" | "stock"
