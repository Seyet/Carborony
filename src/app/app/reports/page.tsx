import type { Metadata } from "next"

import { ReportsSetupRequired } from "@/features/reports/reports-setup-required"
import { ReportsWorkspace } from "@/features/reports/reports-workspace"
import {
  getReportsPageData,
  ReportsSetupRequiredError,
} from "@/features/reports/server/get-reports"

export const metadata: Metadata = { title: "Reports" }

type ReportsPageProps = {
  searchParams: Promise<{
    categoryId?: string | string[]
    endDate?: string | string[]
    page?: string | string[]
    paymentMethod?: string | string[]
    productId?: string | string[]
    report?: string | string[]
    staffId?: string | string[]
    startDate?: string | string[]
    view?: string | string[]
  }>
}

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams
  let data: Awaited<ReturnType<typeof getReportsPageData>>

  try {
    data = await getReportsPageData({
      categoryId: first(params.categoryId),
      endDate: first(params.endDate),
      page: first(params.page),
      paymentMethod: first(params.paymentMethod),
      productId: first(params.productId),
      report: first(params.report),
      staffId: first(params.staffId),
      startDate: first(params.startDate),
      view: first(params.view),
    })
  } catch (error) {
    if (error instanceof ReportsSetupRequiredError) {
      return <ReportsSetupRequired />
    }
    throw error
  }

  return <ReportsWorkspace data={data} />
}
