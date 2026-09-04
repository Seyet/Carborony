import type {
  InstagramCategoryCandidate,
  InstagramCategoryMatch,
  InstagramExtractionField,
} from "../types"
import { emptyField, escapeRegExp, field, normalizedSearchText, sentenceAt } from "./shared"

const categoryAliases: Record<string, string[]> = {
  accessories: ["accessory", "belt", "cap", "hat", "scarf", "sunglasses", "wallet"],
  bags: ["bag", "backpack", "clutch", "handbag", "purse", "tote"],
  beauty: ["beauty", "body cream", "cosmetics", "foundation", "lip gloss", "makeup", "skincare"],
  clothing: ["blouse", "clothing", "dress", "gown", "jacket", "jeans", "shirt", "skirt", "trousers"],
  electronics: ["charger", "electronics", "headphones", "laptop", "phone", "power bank", "speaker"],
  fashion: ["blouse", "clothing", "dress", "gown", "jacket", "jeans", "shirt", "skirt", "trousers"],
  footwear: ["boots", "footwear", "heels", "sandals", "shoes", "slides", "sneakers"],
  jewellery: ["bracelet", "earrings", "jewellery", "necklace", "ring"],
  jewelry: ["bracelet", "earrings", "jewelry", "necklace", "ring"],
}

type ScoredMatch = {
  category: InstagramCategoryCandidate
  confidence: number
  index: number
  term: string
}

function termIndex(caption: string, term: string) {
  const flexibleTerm = escapeRegExp(term).replace(/\\ /g, "[\\s-]+")
  const expression = new RegExp(`(^|[^\\p{L}\\p{N}])(${flexibleTerm})(?=$|[^\\p{L}\\p{N}])`, "iu")
  const match = expression.exec(caption)
  return match?.index === undefined ? -1 : match.index + match[1].length
}

export function matchCategory(
  caption: string,
  suggestedName: string | null,
  categories: readonly InstagramCategoryCandidate[],
): InstagramExtractionField<InstagramCategoryMatch> {
  if (!categories.length) return emptyField()
  const searchable = `${suggestedName ?? ""}\n${caption}`
  const matches: ScoredMatch[] = []

  for (const category of categories) {
    const normalizedName = normalizedSearchText(category.name)
    const singularName = normalizedName.endsWith("s") ? normalizedName.slice(0, -1) : normalizedName
    const suppliedKeywords = category.keywords ?? []
    const terms = new Map<string, number>()
    if (normalizedName.length >= 2) terms.set(normalizedName, 0.96)
    if (singularName.length >= 3 && singularName !== normalizedName) terms.set(singularName, 0.92)
    suppliedKeywords.forEach((keyword) => {
      const normalized = normalizedSearchText(keyword)
      if (normalized.length >= 2) terms.set(normalized, Math.max(terms.get(normalized) ?? 0, 0.93))
    })
    for (const alias of categoryAliases[normalizedName] ?? categoryAliases[singularName] ?? []) {
      terms.set(alias, Math.max(terms.get(alias) ?? 0, 0.86))
    }

    for (const [term, confidence] of terms) {
      const index = termIndex(searchable, term)
      if (index >= 0) matches.push({ category, confidence, index, term })
    }
  }

  const best = matches.sort((left, right) => (
    right.confidence - left.confidence
    || right.term.length - left.term.length
    || left.index - right.index
  ))[0]
  if (!best) return emptyField()

  const captionIndex = termIndex(caption, best.term)
  const evidence = captionIndex >= 0 ? sentenceAt(caption, captionIndex) : suggestedName
  return field({ id: best.category.id, matchedTerm: best.term, name: best.category.name }, best.confidence, evidence)
}
