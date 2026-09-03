import { countries, currencies } from "@/features/businesses/onboarding/options"

export { businessCategories, countries, currencies, weekDays } from "@/features/businesses/onboarding/options"

export const locales = [
  ["en-NG", "English (Nigeria)"],
  ["en-GH", "English (Ghana)"],
  ["en-KE", "English (Kenya)"],
  ["en-ZA", "English (South Africa)"],
  ["en-UG", "English (Uganda)"],
  ["en-TZ", "English (Tanzania)"],
  ["en-RW", "English (Rwanda)"],
  ["en-CM", "English (Cameroon)"],
  ["fr-CI", "Français (Côte d’Ivoire)"],
  ["fr-SN", "Français (Sénégal)"],
  ["en-ET", "English (Ethiopia)"],
  ["ar-EG", "العربية (مصر)"],
  ["fr-MA", "Français (Maroc)"],
  ["en-GB", "English (United Kingdom)"],
  ["en-US", "English (United States)"],
  ["en-CA", "English (Canada)"],
  ["en-AE", "English (United Arab Emirates)"],
  ["en-IN", "English (India)"],
] as const

export const timeZones = [
  ["Africa/Lagos", "West Africa · Lagos"],
  ["Africa/Accra", "Greenwich Mean Time · Accra"],
  ["Africa/Nairobi", "East Africa · Nairobi"],
  ["Africa/Johannesburg", "South Africa · Johannesburg"],
  ["Africa/Kampala", "East Africa · Kampala"],
  ["Africa/Dar_es_Salaam", "East Africa · Dar es Salaam"],
  ["Africa/Kigali", "Central Africa · Kigali"],
  ["Africa/Douala", "West Africa · Douala"],
  ["Africa/Abidjan", "Greenwich Mean Time · Abidjan"],
  ["Africa/Dakar", "Greenwich Mean Time · Dakar"],
  ["Africa/Addis_Ababa", "East Africa · Addis Ababa"],
  ["Africa/Cairo", "Egypt · Cairo"],
  ["Africa/Casablanca", "Morocco · Casablanca"],
  ["Europe/London", "United Kingdom · London"],
  ["America/New_York", "United States · New York"],
  ["America/Chicago", "United States · Chicago"],
  ["America/Denver", "United States · Denver"],
  ["America/Los_Angeles", "United States · Los Angeles"],
  ["America/Toronto", "Canada · Toronto"],
  ["Asia/Dubai", "United Arab Emirates · Dubai"],
  ["Asia/Kolkata", "India · Kolkata"],
  ["UTC", "Coordinated Universal Time (UTC)"],
] as const

export const dateFormats = [
  ["day_month_year", "Day / month / year"],
  ["month_day_year", "Month / day / year"],
  ["year_month_day", "Year / month / day"],
] as const

export const timeFormats = [
  ["12h", "12-hour time"],
  ["24h", "24-hour time"],
] as const

export const weekStartDays = [
  [0, "Sunday"],
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
] as const

export const countryValues = countries.map(([value]) => value)
export const currencyValues = currencies.map(([value]) => value)
export const localeValues = locales.map(([value]) => value)

export function countryName(code: string) {
  return countries.find(([value]) => value === code)?.[1] ?? code
}

export function currencyName(code: string) {
  return currencies.find(([value]) => value === code)?.[1] ?? code
}
