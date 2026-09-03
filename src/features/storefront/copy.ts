import type { Json } from "@/types/database"
import type { StorefrontCopy } from "./types"

export function defaultStorefrontCopy(
  businessName: string,
  deliveryEnabled: boolean,
): StorefrontCopy {
  return {
    catalogueDescription: "Discover products selected for you and order in just a few steps.",
    catalogueEyebrow: "Our catalogue",
    catalogueTitle: "Find your next favourite",
    footerTagline: `Browse, order, and connect directly with ${businessName}. A simple shopping experience made for you.`,
    heroCtaLabel: "Shop the collection",
    heroEyebrow: `Welcome to ${businessName}`,
    trustOneDescription: "A fast, straightforward checkout",
    trustOneTitle: "Easy ordering",
    trustThreeDescription: "Prices verified before your order",
    trustThreeTitle: "Buy with confidence",
    trustTwoDescription: deliveryEnabled
      ? "Choose your delivery area at checkout"
      : "Collect your order when it is ready",
    trustTwoTitle: deliveryEnabled ? "Delivery available" : "Pickup available",
  }
}

export function storefrontCopy(
  value: Json | null | undefined,
  businessName: string,
  deliveryEnabled: boolean,
): StorefrontCopy {
  const defaults = defaultStorefrontCopy(businessName, deliveryEnabled)
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults
  const source = value as Record<string, Json | undefined>

  function text(key: string, fallback: string) {
    const candidate = source[key]
    return typeof candidate === "string" && candidate.trim() ? candidate.trim() : fallback
  }

  return {
    catalogueDescription: text("catalogue_description", defaults.catalogueDescription),
    catalogueEyebrow: text("catalogue_eyebrow", defaults.catalogueEyebrow),
    catalogueTitle: text("catalogue_title", defaults.catalogueTitle),
    footerTagline: text("footer_tagline", defaults.footerTagline),
    heroCtaLabel: text("hero_cta_label", defaults.heroCtaLabel),
    heroEyebrow: text("hero_eyebrow", defaults.heroEyebrow),
    trustOneDescription: text("trust_one_description", defaults.trustOneDescription),
    trustOneTitle: text("trust_one_title", defaults.trustOneTitle),
    trustThreeDescription: text("trust_three_description", defaults.trustThreeDescription),
    trustThreeTitle: text("trust_three_title", defaults.trustThreeTitle),
    trustTwoDescription: text("trust_two_description", defaults.trustTwoDescription),
    trustTwoTitle: text("trust_two_title", defaults.trustTwoTitle),
  }
}

export function storefrontCopyJson(copy: StorefrontCopy): Json {
  return {
    catalogue_description: copy.catalogueDescription,
    catalogue_eyebrow: copy.catalogueEyebrow,
    catalogue_title: copy.catalogueTitle,
    footer_tagline: copy.footerTagline,
    hero_cta_label: copy.heroCtaLabel,
    hero_eyebrow: copy.heroEyebrow,
    trust_one_description: copy.trustOneDescription,
    trust_one_title: copy.trustOneTitle,
    trust_three_description: copy.trustThreeDescription,
    trust_three_title: copy.trustThreeTitle,
    trust_two_description: copy.trustTwoDescription,
    trust_two_title: copy.trustTwoTitle,
  }
}
