export type InstagramConnectionStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "expired"
  | "needs_reauthorization"

export type InstagramAccountType = "business" | "creator"

export type InstagramConnection = {
  accountId: string | null
  accountType: InstagramAccountType | null
  connectedAt: string | null
  lastSyncedAt: string | null
  status: InstagramConnectionStatus
  syncEnabled: boolean
  tokenExpiresAt: string | null
  username: string | null
}

export type InstagramImportStatus =
  | "attached"
  | "catalogue_draft"
  | "failed"
  | "ignored"
  | "incomplete"
  | "needs_review"
  | "possible_duplicate"
  | "published"
  | "ready"

export type InstagramMediaType = "carousel" | "image" | "reel" | "video"

export type InstagramImportSuggestion = {
  category: string | null
  colours: string[]
  currency: string | null
  missingFields: string[]
  name: string | null
  overallConfidence: number
  price: number | null
}

export type InstagramDuplicateSummary = {
  name: string
  productId: string
  score: number
}

export type InstagramImportSummary = {
  caption: string | null
  duplicate: InstagramDuplicateSummary | null
  id: string
  mediaType: InstagramMediaType
  permalink: string
  publishedAt: string
  status: InstagramImportStatus
  suggested: InstagramImportSuggestion
  thumbnailUrl: string | null
}

export type InstagramWorkspaceData = {
  canConnect: boolean
  canManage: boolean
  connection: InstagramConnection
  imports: InstagramImportSummary[]
  isPreview: boolean
}

export type InstagramSettingsData = {
  configurationReady: boolean
  connection: InstagramConnection
  setupReady: boolean
}

export type InstagramDraftField =
  | "brand"
  | "categoryId"
  | "colours"
  | "description"
  | "discountPrice"
  | "name"
  | "sellingPrice"
  | "sizes"
  | "sku"
  | "stockQuantity"
  | "tags"

export type InstagramFieldConfidence = {
  confidence: number
  evidence: string | null
}

export type InstagramEditableProductDraft = {
  brand: string
  categoryId: string
  colours: string
  description: string
  discountPrice: string
  name: string
  sellingPrice: string
  sizes: string
  sku: string
  stockQuantity: string
  tags: string
}

export type InstagramImportReviewData = {
  businessCurrency: string
  canManage: boolean
  categories: Array<{ id: string; name: string }>
  connectionUsername: string
  draft: InstagramEditableProductDraft
  duplicateCandidates: InstagramDuplicateSummary[]
  fieldConfidence: Partial<Record<InstagramDraftField, InstagramFieldConfidence>>
  id: string
  isPreview: boolean
  source: {
    caption: string | null
    mediaType: InstagramMediaType
    mediaUrl: string | null
    permalink: string
    publishedAt: string
  }
}

export type InstagramExtractionField<T> = {
  confidence: number
  evidence: string | null
  value: T | null
}

export type InstagramCategoryCandidate = {
  id: string
  keywords?: readonly string[]
  name: string
}

export type InstagramCategoryMatch = {
  id: string
  matchedTerm: string
  name: string
}

export type InstagramCaptionExtraction = {
  brand: InstagramExtractionField<string>
  category: InstagramExtractionField<InstagramCategoryMatch>
  colours: InstagramExtractionField<string[]>
  currency: InstagramExtractionField<string>
  deliveryInformation: InstagramExtractionField<string>
  description: InstagramExtractionField<string>
  discountPrice: InstagramExtractionField<number>
  name: InstagramExtractionField<string>
  promotionalInformation: InstagramExtractionField<string>
  sellingPrice: InstagramExtractionField<number>
  sizes: InstagramExtractionField<string[]>
  stockQuantity: InstagramExtractionField<number>
  warnings: string[]
}

export type ExtractInstagramCaptionInput = {
  businessCurrencyCode?: unknown
  caption: unknown
  categories?: unknown
}

export type InstagramDraftOption = {
  name: "Colour" | "Size"
  values: string[]
}

export type InstagramCatalogueDraftDefaults = {
  categoryId: string | null
  description: string
  discountPrice: number | null
  name: string
  options: InstagramDraftOption[]
  sellingPrice: number | null
  specifications: Array<{ name: string; unit: ""; value: string }>
  status: "draft"
  stockQuantity: number | null
  tags: string[]
  trackInventory: boolean
}
