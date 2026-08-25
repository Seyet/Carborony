import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { z } from "zod"

import { ButtonLink } from "@/components/ui/button"
import { CustomerForm } from "@/features/customers/customer-form"
import { CustomersSetupRequired } from "@/features/customers/customers-setup-required"
import { CustomersSetupRequiredError, getCustomerDetails } from "@/features/customers/server/customers"
import { ApiError } from "@/lib/api/server"

export const metadata: Metadata = { title: "Edit customer" }

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const validation = z.object({ id: z.uuid() }).safeParse(await params)
  if (!validation.success) notFound()
  let customer: Awaited<ReturnType<typeof getCustomerDetails>> | null = null
  try { customer = await getCustomerDetails(validation.data.id, 1) } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    if (!(error instanceof CustomersSetupRequiredError)) throw error
  }
  if (!customer) return <CustomersSetupRequired />
  return <div className="space-y-6"><header><ButtonLink href={`/app/customers/${customer.profile.id}`} size="sm" variant="ghost"><ArrowLeft aria-hidden="true" />Customer</ButtonLink><h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Edit {customer.profile.name}</h1><p className="mt-1 text-sm text-muted-foreground">Update contact information, notes, tags, and customer segment.</p></header><CustomerForm customer={customer.profile} /></div>
}
