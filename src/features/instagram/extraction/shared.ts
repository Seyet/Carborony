import type { InstagramExtractionField } from "../types"

export const MAX_CAPTION_LENGTH = 10_000
export const MAX_EVIDENCE_LENGTH = 240
export const MAX_RESULT_TEXT_LENGTH = 5_000

export function emptyField<T>(): InstagramExtractionField<T> {
  return { confidence: 0, evidence: null, value: null }
}

export function field<T>(
  value: T,
  confidence: number,
  evidence: string | null,
): InstagramExtractionField<T> {
  return {
    confidence: Math.max(0, Math.min(1, Number(confidence.toFixed(2)))),
    evidence: evidence ? limitText(evidence, MAX_EVIDENCE_LENGTH) : null,
    value,
  }
}

export function limitText(value: string, maximum: number) {
  const points = Array.from(value)
  if (points.length <= maximum) return value
  return points.slice(0, maximum).join("").trimEnd()
}

export function cleanCaption(value: unknown) {
  if (typeof value !== "string") return ""
  return limitText(
    value
      .replace(/\r\n?/g, "\n")
      .replace(/[\t\f\v]+/g, " ")
      .replace(/[ \u00a0]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    MAX_CAPTION_LENGTH,
  )
}

export function normalizedSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function compactEvidence(value: string) {
  return limitText(value.replace(/\s+/g, " ").trim(), MAX_EVIDENCE_LENGTH)
}

export function sentenceAt(caption: string, index: number) {
  const before = caption.slice(0, index)
  const after = caption.slice(index)
  const startBreak = Math.max(
    before.lastIndexOf("\n"),
    before.lastIndexOf("."),
    before.lastIndexOf("!"),
    before.lastIndexOf("?"),
  )
  const endings = [after.indexOf("\n"), after.indexOf("."), after.indexOf("!"), after.indexOf("?")]
    .filter((candidate) => candidate >= 0)
  const endBreak = endings.length ? Math.min(...endings) : after.length
  return compactEvidence(caption.slice(startBreak + 1, index + endBreak + 1))
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function titleCase(value: string) {
  const smallWords = new Set(["and", "for", "in", "of", "the", "with"])
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && smallWords.has(word.toLocaleLowerCase("en"))) return word.toLocaleLowerCase("en")
      return word.charAt(0).toLocaleUpperCase("en") + word.slice(1).toLocaleLowerCase("en")
    })
    .join(" ")
}
