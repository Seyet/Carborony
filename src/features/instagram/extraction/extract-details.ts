import type { InstagramExtractionField } from "../types"
import { compactEvidence, emptyField, field, limitText, sentenceAt, titleCase } from "./shared"

function firstMatchingSentence(caption: string, expression: RegExp) {
  const match = expression.exec(caption)
  if (match?.index === undefined) return null
  return sentenceAt(caption, match.index)
}

export function extractDescription(caption: string): InstagramExtractionField<string> {
  if (!caption) return emptyField()
  const description = limitText(
    caption
      .replace(/https?:\/\/\S+/giu, "")
      .replace(/(?:^|\s)#[\p{L}\p{N}_]+/gu, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    5_000,
  )
  return description ? field(description, 0.78, compactEvidence(description)) : emptyField()
}

export function extractBrand(caption: string): InstagramExtractionField<string> {
  const match = /\bbrand\s*:\s*([^.!?\n]{1,80})/iu.exec(caption)
  if (!match) return emptyField()
  const value = match[1]
    .replace(/(?:^|\s)[#@][\p{L}\p{N}_.]+/gu, " ")
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!value) return emptyField()
  return field(limitText(titleCase(value), 80), 0.98, compactEvidence(match[0]))
}

export function extractDeliveryInformation(caption: string): InstagramExtractionField<string> {
  const evidence = firstMatchingSentence(
    caption,
    /\b(?:delivery|deliver(?:ed|ing|s)?|shipping|ships?|pickup|pick-up|dispatch)\b/iu,
  )
  return evidence ? field(limitText(evidence, 500), 0.92, evidence) : emptyField()
}

export function extractPromotionalInformation(caption: string): InstagramExtractionField<string> {
  const evidence = firstMatchingSentence(
    caption,
    /(?:\b\d{1,3}\s*%\s*off\b|\b(?:sale|promo(?:tion)?|discount|special offer|limited offer|clearance|free delivery|free shipping)\b|\bwas\b.{1,80}\bnow\b)/iu,
  )
  return evidence ? field(limitText(evidence, 500), 0.9, evidence) : emptyField()
}

export function extractStockQuantity(caption: string): InstagramExtractionField<number> {
  const soldOut = /\bsold[ -]?out\b/iu.exec(caption)
  if (soldOut?.index !== undefined) return field(0, 0.99, sentenceAt(caption, soldOut.index))

  const patterns = [
    /\b(?:stock|qty|quantity)\s*:\s*(\d{1,9})\b/iu,
    /\bonly\s+(\d{1,9})\s+(?:left|remaining|available|in stock)\b/iu,
    /\b(\d{1,9})\s+(?:pieces?|units?|items?)\s+(?:left|remaining|available|in stock)\b/iu,
  ]
  for (const expression of patterns) {
    const match = expression.exec(caption)
    if (match?.index === undefined) continue
    const value = Number(match[1])
    if (Number.isSafeInteger(value) && value >= 0 && value <= 999_999_999) {
      return field(value, 0.97, sentenceAt(caption, match.index))
    }
  }
  return emptyField()
}
