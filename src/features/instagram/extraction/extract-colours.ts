import type { InstagramExtractionField } from "../types"
import { emptyField, escapeRegExp, field, sentenceAt } from "./shared"

const colourNames: Array<[string, string]> = [
  ["multicolour", "Multicolour"],
  ["multi-colour", "Multicolour"],
  ["multicolor", "Multicolour"],
  ["multi-color", "Multicolour"],
  ["rose gold", "Rose Gold"],
  ["off-white", "Off White"],
  ["off white", "Off White"],
  ["burgundy", "Burgundy"],
  ["turquoise", "Turquoise"],
  ["mustard", "Mustard"],
  ["lavender", "Lavender"],
  ["charcoal", "Charcoal"],
  ["maroon", "Maroon"],
  ["magenta", "Magenta"],
  ["purple", "Purple"],
  ["orange", "Orange"],
  ["yellow", "Yellow"],
  ["silver", "Silver"],
  ["cream", "Cream"],
  ["beige", "Beige"],
  ["brown", "Brown"],
  ["black", "Black"],
  ["white", "White"],
  ["grey", "Grey"],
  ["gray", "Grey"],
  ["green", "Green"],
  ["navy", "Navy"],
  ["blue", "Blue"],
  ["indigo", "Indigo"],
  ["violet", "Violet"],
  ["pink", "Pink"],
  ["coral", "Coral"],
  ["peach", "Peach"],
  ["khaki", "Khaki"],
  ["teal", "Teal"],
  ["cyan", "Cyan"],
  ["gold", "Gold"],
  ["tan", "Tan"],
  ["red", "Red"],
]

colourNames.sort((left, right) => right[0].length - left[0].length)

export function extractColours(caption: string): InstagramExtractionField<string[]> {
  const found = new Map<string, { index: number; source: string }>()

  for (const [source, canonical] of colourNames) {
    const expression = new RegExp(`(^|[^\\p{L}])(${escapeRegExp(source)})(?=$|[^\\p{L}])`, "giu")
    const match = expression.exec(caption)
    if (!match?.index && match?.index !== 0) continue
    const index = match.index + match[1].length
    const nearby = caption.slice(Math.max(0, index - 12), index + source.length + 12).toLocaleLowerCase("en")
    if (canonical === "Black" && /black\s+friday/.test(nearby)) continue
    if (!found.has(canonical)) found.set(canonical, { index, source })
  }

  if (!found.size) return emptyField()
  const ordered = [...found.entries()].sort((left, right) => left[1].index - right[1].index)
  const first = ordered[0][1]
  const evidence = sentenceAt(caption, first.index)
  const strongContext = /(?:colou?rs?|available|comes?|options?|choose|in)\b/i.test(evidence)
  return field(ordered.map(([canonical]) => canonical), strongContext ? 0.94 : 0.68, evidence)
}
