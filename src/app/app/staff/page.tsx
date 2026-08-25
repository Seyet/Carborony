import type { Metadata } from "next"

import { StaffAccessDenied } from "@/features/staff/staff-access-denied"
import { StaffManagement } from "@/features/staff/staff-management"
import { StaffSetupRequired } from "@/features/staff/staff-setup-required"
import {
  getStaffPageData,
  StaffAccessDeniedError,
  StaffSetupRequiredError,
} from "@/features/staff/server/get-staff"

export const metadata: Metadata = { title: "Staff" }

export default async function StaffPage() {
  let data: Awaited<ReturnType<typeof getStaffPageData>>

  try {
    data = await getStaffPageData()
  } catch (error) {
    if (error instanceof StaffSetupRequiredError) return <StaffSetupRequired />
    if (error instanceof StaffAccessDeniedError) return <StaffAccessDenied />
    throw error
  }

  return <StaffManagement data={data} />
}
