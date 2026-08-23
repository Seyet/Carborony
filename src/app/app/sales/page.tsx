import type { Metadata } from "next"

import { PosSetupRequired } from "@/features/sales/pos/pos-setup-required"
import { PosWorkspace } from "@/features/sales/pos/pos-workspace"
import {
  getPosCatalog,
  PosSetupRequiredError,
} from "@/features/sales/pos/server/get-pos-catalog"
import type { PosCatalog } from "@/features/sales/pos/types"

export const metadata: Metadata = { title: "Sales" }

export default async function SalesPage() {
  let catalog: PosCatalog | null = null
  let setupRequired = false

  try {
    catalog = await getPosCatalog()
  } catch (error) {
    if (error instanceof PosSetupRequiredError) setupRequired = true
    else throw error
  }

  if (setupRequired || !catalog) return <PosSetupRequired />
  return <PosWorkspace catalog={catalog} />
}
