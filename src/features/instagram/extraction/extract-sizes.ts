import type { InstagramExtractionField } from "../types"
import { emptyField, field, sentenceAt } from "./shared"

const alphaSizes: Record<string, string> = {
  "2xl": "XXL",
  "3xl": "3XL",
  "4xl": "4XL",
  "5xl": "5XL",
  extra_large: "XL",
  extra_small: "XS",
  l: "L",
  large: "Large",
  m: "M",
  medium: "Medium",
  one_size: "One size",
  s: "S",
  small: "Small",
  xl: "XL",
  xs: "XS",
  xxl: "XXL",
  xxs: "XXS",
}

function normalizedAlphaSize(value: string) {
  return alphaSizes[value.trim().toLocaleLowerCase("en").replace(/[\s-]+/g, "_")] ?? null
}

function valuesFromSizeSection(section: string) {
  const values: string[] = []
  const add = (value: string) => {
    const normalized = value.trim().replace(/\s*[–-]\s*/g, "–")
    if (normalized && !values.some((existing) => existing.toLocaleLowerCase("en") === normalized.toLocaleLowerCase("en"))) {
      values.push(normalized)
    }
  }

  const alphaPattern = /\b(one[ -]size|extra[ -]small|extra[ -]large|xxs|xs|small|medium|large|xxl|[2-5]xl|xl|s|m|l)\b/giu
  for (const match of section.matchAll(alphaPattern)) {
    const normalized = normalizedAlphaSize(match[1])
    if (normalized) add(normalized)
  }

  const numericPattern = /\b\d{1,3}(?:\s*[–-]\s*\d{1,3})?(?:\s*(?:,|\/|and)\s*\d{1,3})*\b/giu
  for (const match of section.matchAll(numericPattern)) {
    const parts = match[0].split(/\s*(?:,|\/|and)\s*/i)
    parts.forEach(add)
  }

  const measurementPattern = /\b\d+(?:[.,]\d+)?\s*(?:inches|inch|in|centimetres|centimeters|cm)\b/giu
  for (const match of section.matchAll(measurementPattern)) add(match[0].replace(/\s+/g, " "))

  return values.slice(0, 30)
}

export function extractSizes(caption: string): InstagramExtractionField<string[]> {
  const contextualPattern = /\b(?:sizes?|size\s+options?)\s*(?:available|are|include)?\s*[:=-]?\s*([^.!?\n]{1,140})/giu
  const contextualMatch = contextualPattern.exec(caption)
  if (contextualMatch) {
    const values = valuesFromSizeSection(contextualMatch[1])
    if (values.length) return field(values, 0.96, sentenceAt(caption, contextualMatch.index))
  }

  const oneSizeMatch = /\bone[ -]size(?: fits all)?\b/iu.exec(caption)
  if (oneSizeMatch?.index !== undefined) return field(["One size"], 0.94, sentenceAt(caption, oneSizeMatch.index))

  const measurementMatch = /\b\d+(?:[.,]\d+)?\s*(?:inches|inch|centimetres|centimeters|cm)\b/iu.exec(caption)
  if (measurementMatch?.index !== undefined) {
    return field([measurementMatch[0].replace(/\s+/g, " ")], 0.74, sentenceAt(caption, measurementMatch.index))
  }

  return emptyField()
}
