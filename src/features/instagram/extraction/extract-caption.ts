import type {
  ExtractInstagramCaptionInput,
  InstagramCaptionExtraction,
  InstagramCatalogueDraftDefaults,
  InstagramCategoryCandidate,
} from "../types"
import { extractColours } from "./extract-colours"
import {
  extractBrand,
  extractDeliveryInformation,
  extractDescription,
  extractPromotionalInformation,
  extractStockQuantity,
} from "./extract-details"
import { extractName } from "./extract-name"
import { extractPrices } from "./extract-prices"
import { extractSizes } from "./extract-sizes"
import { matchCategory } from "./match-category"
import { cleanCaption, limitText } from "./shared"

const MAX_CATEGORIES = 500
const MAX_CATEGORY_KEYWORDS = 30

function businessCurrencyCode(value: unknown) {
  if (typeof value !== "string") return "NGN"
  const normalized = value.trim().toLocaleUpperCase("en")
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "NGN"
}

function categoryCandidates(value: unknown): InstagramCategoryCandidate[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const candidates: InstagramCategoryCandidate[] = []

  for (const candidate of value.slice(0, MAX_CATEGORIES)) {
    if (!candidate || typeof candidate !== "object") continue
    const record = candidate as Record<string, unknown>
    if (typeof record.id !== "string" || typeof record.name !== "string") continue
    const id = limitText(record.id.trim(), 128)
    const name = limitText(record.name.trim(), 100)
    if (!id || !name || seen.has(id)) continue
    seen.add(id)

    const keywords = Array.isArray(record.keywords)
      ? record.keywords
        .filter((keyword): keyword is string => typeof keyword === "string")
        .map((keyword) => limitText(keyword.trim(), 60))
        .filter(Boolean)
        .slice(0, MAX_CATEGORY_KEYWORDS)
      : undefined
    candidates.push({ id, keywords, name })
  }

  return candidates
}

export function extractInstagramCaption(input: ExtractInstagramCaptionInput): InstagramCaptionExtraction {
  const caption = cleanCaption(input?.caption)
  const categories = categoryCandidates(input?.categories)
  const currencyCode = businessCurrencyCode(input?.businessCurrencyCode)
  const name = extractName(caption)
  const prices = extractPrices(caption, currencyCode)
  const category = matchCategory(caption, name.value, categories)
  const warnings = [...prices.warnings]

  if (!caption) warnings.unshift("The Instagram post has no usable caption. Enter the product details manually.")
  if (!name.value) warnings.push("No reliable product name was found. Enter the product name manually.")
  if (categories.length && !category.value) warnings.push("The post did not match an existing catalogue category. Choose one manually.")

  return {
    brand: extractBrand(caption),
    category,
    colours: extractColours(caption),
    currency: prices.currency,
    deliveryInformation: extractDeliveryInformation(caption),
    description: extractDescription(caption),
    discountPrice: prices.discountPrice,
    name,
    promotionalInformation: extractPromotionalInformation(caption),
    sellingPrice: prices.sellingPrice,
    sizes: extractSizes(caption),
    stockQuantity: extractStockQuantity(caption),
    warnings: [...new Set(warnings)],
  }
}

export function toInstagramCatalogueDraftDefaults(
  extraction: InstagramCaptionExtraction,
): InstagramCatalogueDraftDefaults {
  const options: InstagramCatalogueDraftDefaults["options"] = []
  if (extraction.colours.value?.length) options.push({ name: "Colour", values: [...extraction.colours.value] })
  if (extraction.sizes.value?.length) options.push({ name: "Size", values: [...extraction.sizes.value] })

  return {
    categoryId: extraction.category.value?.id ?? null,
    description: extraction.description.value ?? "",
    discountPrice: extraction.discountPrice.value,
    name: extraction.name.value ?? "",
    options,
    sellingPrice: extraction.sellingPrice.value,
    specifications: extraction.brand.value
      ? [{ name: "Brand", unit: "", value: extraction.brand.value }]
      : [],
    status: "draft",
    stockQuantity: extraction.stockQuantity.value,
    tags: [],
    trackInventory: extraction.stockQuantity.value !== null,
  }
}
