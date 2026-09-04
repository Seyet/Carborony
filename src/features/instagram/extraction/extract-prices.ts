import type { InstagramExtractionField } from "../types"
import { compactEvidence, emptyField, field, sentenceAt } from "./shared"

type PriceLabel = "regular" | "sale" | null

type PriceCandidate = {
  confidence: number
  currency: string
  end: number
  evidence: string
  explicitCurrency: boolean
  index: number
  label: PriceLabel
  value: number
}

export type PriceExtraction = {
  currency: InstagramExtractionField<string>
  discountPrice: InstagramExtractionField<number>
  sellingPrice: InstagramExtractionField<number>
  warnings: string[]
}

const currencyToken = [
  "NGN", "Naira", "₦",
  "USD", "US\\$", "\\$",
  "EUR", "€",
  "GBP", "£",
  "GHS", "GH₵",
  "KES", "KSh",
  "ZAR",
  "XOF", "XAF", "CFA",
  "AED", "د\\.إ",
  "INR", "₹",
  "CAD", "C\\$",
].join("|")

const amountToken = String.raw`\d(?:[\d,.\u00a0 ]{0,17}\d)?(?:\s*[kKmM])?`

function normalizedCurrency(token: string, fallback: string) {
  const normalized = token.replace(/\s+/g, "").toLocaleUpperCase("en")
  if (normalized === "₦" || normalized === "NAIRA" || normalized === "NGN") return "NGN"
  if (normalized === "$" || normalized === "US$" || normalized === "USD") {
    return fallback === "CAD" ? "CAD" : "USD"
  }
  if (normalized === "C$" || normalized === "CAD") return "CAD"
  if (normalized === "€" || normalized === "EUR") return "EUR"
  if (normalized === "£" || normalized === "GBP") return "GBP"
  if (normalized === "GH₵" || normalized === "GHS") return "GHS"
  if (normalized === "KSH" || normalized === "KES") return "KES"
  if (normalized === "ZAR") return "ZAR"
  if (normalized === "CFA") return fallback === "XAF" ? "XAF" : "XOF"
  if (normalized === "XOF" || normalized === "XAF") return normalized
  if (normalized === "AED" || normalized === "د.إ") return "AED"
  if (normalized === "INR" || normalized === "₹") return "INR"
  return fallback
}

function parseAmount(input: string) {
  const normalized = input.replace(/[\u00a0\s]/g, "").toLocaleLowerCase("en")
  const suffix = normalized.endsWith("k") ? "k" : normalized.endsWith("m") ? "m" : ""
  const numeric = suffix ? normalized.slice(0, -1) : normalized
  if (!/^\d[\d,.]*$/.test(numeric)) return null

  const comma = numeric.lastIndexOf(",")
  const dot = numeric.lastIndexOf(".")
  let canonical = numeric

  if (comma >= 0 && dot >= 0) {
    const decimalSeparator = comma > dot ? "," : "."
    const thousandsSeparator = decimalSeparator === "," ? "." : ","
    canonical = numeric.split(thousandsSeparator).join("")
    const decimalIndex = canonical.lastIndexOf(decimalSeparator)
    const decimalPlaces = canonical.length - decimalIndex - 1
    canonical = decimalPlaces > 0 && decimalPlaces <= 4
      ? `${canonical.slice(0, decimalIndex).replaceAll(decimalSeparator, "")}.${canonical.slice(decimalIndex + 1)}`
      : canonical.replaceAll(decimalSeparator, "")
  } else {
    const separator = comma >= 0 ? "," : dot >= 0 ? "." : null
    if (separator) {
      const pieces = numeric.split(separator)
      const groupedThousands = pieces.length > 1 && pieces.slice(1).every((piece) => piece.length === 3)
      canonical = groupedThousands
        ? pieces.join("")
        : `${pieces.slice(0, -1).join("")}.${pieces.at(-1)}`
    }
  }

  const parsed = Number(canonical) * (suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : 1)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 999_999_999_999) return null
  return Math.round(parsed * 10_000) / 10_000
}

function priceLabel(caption: string, index: number): PriceLabel {
  const context = caption.slice(Math.max(0, index - 32), index).toLocaleLowerCase("en")
  if (/(?:was|old(?:\s+price)?|original(?:\s+price)?|before|from)\s*[:=-]?\s*$/.test(context)) return "regular"
  if (/(?:now|sale(?:\s+price)?|promo(?:\s+price)?|offer(?:\s+price)?|today|only|to)\s*[:=-]?\s*$/.test(context)) return "sale"
  return null
}

function addCandidate(candidates: PriceCandidate[], candidate: PriceCandidate) {
  const existingIndex = candidates.findIndex((item) => (
    Math.abs(item.index - candidate.index) <= 2
    && item.value === candidate.value
    && item.currency === candidate.currency
  ))
  if (existingIndex < 0) {
    candidates.push(candidate)
    return
  }
  const existing = candidates[existingIndex]
  if (candidate.confidence > existing.confidence) {
    candidates[existingIndex] = {
      ...candidate,
      label: candidate.label ?? existing.label,
    }
  } else if (!existing.label && candidate.label) {
    candidates[existingIndex] = { ...existing, label: candidate.label }
  }
}

function collectCandidates(caption: string, fallbackCurrency: string) {
  const candidates: PriceCandidate[] = []
  const addMatch = (
    match: RegExpExecArray,
    amount: string,
    currency: string | undefined,
    confidence: number,
  ) => {
    const value = parseAmount(amount)
    if (value === null) return
    const currencyCode = currency ? normalizedCurrency(currency, fallbackCurrency) : fallbackCurrency
    const amountOffset = match[0].indexOf(amount)
    const index = (match.index ?? 0) + Math.max(0, amountOffset)
    addCandidate(candidates, {
      confidence,
      currency: currencyCode,
      end: index + amount.length,
      evidence: sentenceAt(caption, index),
      explicitCurrency: Boolean(currency),
      index,
      label: priceLabel(caption, currency ? match.index : index),
      value,
    })
  }

  const prefixed = new RegExp(`(${currencyToken})\\s*(${amountToken})`, "giu")
  let match: RegExpExecArray | null
  while ((match = prefixed.exec(caption))) addMatch(match, match[2], match[1], 0.97)

  const suffixed = new RegExp(`(${amountToken})\\s*(${currencyToken})(?![a-z])`, "giu")
  while ((match = suffixed.exec(caption))) addMatch(match, match[1], match[2], 0.97)

  const labelled = new RegExp(
    `(?:price|cost|now|sale(?:\\s+price)?|promo(?:\\s+price)?|only)\\s*[:=-]?\\s*(?:(${currencyToken})\\s*)?(${amountToken})`,
    "giu",
  )
  while ((match = labelled.exec(caption))) addMatch(match, match[2], match[1], match[1] ? 0.98 : 0.84)

  const shorthand = new RegExp(`\\b(${amountToken.replace("(?:\\s*[kKmM])?", "\\s*[kKmM]")})\\b`, "gu")
  while ((match = shorthand.exec(caption))) addMatch(match, match[1], undefined, 0.65)

  return candidates.sort((left, right) => left.index - right.index)
}

function pricePair(candidates: PriceCandidate[]) {
  const regular = candidates.find((candidate) => candidate.label === "regular")
  if (!regular) return null
  const sale = candidates.find((candidate) => (
    candidate.label === "sale"
    && candidate.index > regular.index
    && candidate.index - regular.end <= 80
    && candidate.currency === regular.currency
    && candidate.value <= regular.value
  ))
  return sale ? { regular, sale } : null
}

export function extractPrices(caption: string, businessCurrencyCode: string): PriceExtraction {
  const candidates = collectCandidates(caption, businessCurrencyCode)
  const warnings: string[] = []
  if (!candidates.length) {
    return {
      currency: emptyField(),
      discountPrice: emptyField(),
      sellingPrice: emptyField(),
      warnings: ["No product price was found. Enter and confirm the price manually."],
    }
  }

  const pair = pricePair(candidates)
  const selected = pair?.sale ?? [...candidates].sort((left, right) => right.confidence - left.confidence)[0]
  if (candidates.some((candidate) => candidate.explicitCurrency && candidate.currency !== businessCurrencyCode)) {
    warnings.push(`The caption contains a currency that differs from ${businessCurrencyCode}. Confirm the product currency and price.`)
  }

  const uniqueAmounts = new Set(candidates.map((candidate) => `${candidate.currency}:${candidate.value}`))
  if (!pair && uniqueAmounts.size > 1) {
    warnings.push("Multiple prices were found without a clear original-price and sale-price relationship. Confirm the correct price.")
  }

  const currencyConfidence = selected.explicitCurrency ? 0.99 : 0.62
  return {
    currency: field(selected.currency, currencyConfidence, selected.evidence),
    discountPrice: pair
      ? field(pair.sale.value, Math.min(pair.sale.confidence, 0.97), pair.sale.evidence)
      : emptyField(),
    sellingPrice: pair
      ? field(pair.regular.value, Math.min(pair.regular.confidence, 0.97), pair.regular.evidence)
      : field(selected.value, selected.confidence, selected.evidence),
    warnings,
  }
}

export function priceEvidenceText(caption: string, index: number) {
  return compactEvidence(sentenceAt(caption, index))
}
