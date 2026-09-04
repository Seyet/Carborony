import type { InstagramExtractionField } from "../types"
import { compactEvidence, emptyField, field, limitText, titleCase } from "./shared"

const genericNames = new Set([
  "available now",
  "dont miss out",
  "new arrival",
  "new arrivals",
  "now available",
  "shop now",
])

function cleanName(value: string) {
  const withoutUrlOrHandle = value
    .replace(/https?:\/\/\S+/giu, " ")
    .replace(/(?:^|\s)[#@][\p{L}\p{N}_.]+/gu, " ")
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, " ")
    .split(/\b(?:available\s+in|comes?\s+in|colou?rs?|sizes?|price|nationwide\s+delivery|delivery|shipping)\b/iu)[0]
    .replace(/^(?:introducing|meet|just\s+dropped|new\s+arrival:?|our\s+new|the\s+new)\s+/iu, "")
    .replace(/\s+(?:is\s+)?(?:finally\s+)?here\s*$/iu, "")
    .replace(/\s+(?:is\s+)?now\s+available\s*$/iu, "")
    .replace(/^[\s:;,!?.–—-]+|[\s:;,!?.–—-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()

  if (withoutUrlOrHandle.length < 2 || genericNames.has(withoutUrlOrHandle.toLocaleLowerCase("en"))) return null
  const words = withoutUrlOrHandle.split(" ").slice(0, 14).join(" ")
  return limitText(titleCase(words), 160)
}

export function extractName(caption: string): InstagramExtractionField<string> {
  const explicit = /\b(?:product|item|name)\s*:\s*([^.!?\n]{2,160})/iu.exec(caption)
  if (explicit) {
    const name = cleanName(explicit[1])
    if (name) return field(name, 0.97, compactEvidence(explicit[0]))
  }

  const segments = caption
    .split(/(?:[.!?]+|\n+)/u)
    .map((segment) => segment.trim())
    .filter(Boolean)

  for (const segment of segments.slice(0, 8)) {
    if (/^(?:https?:\/\/|[#@]|available\b|in\s+stock\b|dm\b|message\b|call\b|whats?app\b|shop\b|(?:was|now|only|sale|promo|offer|regular\s+price)\b|(?:price|delivery|shipping|size|colou?r)s?\s*:)/iu.test(segment)) continue
    const name = cleanName(segment)
    if (name) return field(name, 0.72, compactEvidence(segment))
  }

  return emptyField()
}
