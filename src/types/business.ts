import type { Tables } from "@/types/database"

export type Business = Tables<"businesses">
export type BusinessMember = Tables<"business_members">
export type Profile = Tables<"profiles">
export type Role = Tables<"roles">

/**
 * The minimal tenant context future data-access functions can accept.
 * Selecting or switching the active business is intentionally not implemented yet.
 */
export type BusinessContext = {
  activeBusinessId: Business["id"]
  membership: BusinessMember
}
