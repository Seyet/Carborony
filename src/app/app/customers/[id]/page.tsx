import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil } from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { CustomerDetails } from "@/features/customers/customer-details"
import { CustomersSetupRequired } from "@/features/customers/customers-setup-required"
import { customerHistoryPageSize, CustomersSetupRequiredError, getCustomerDetails } from "@/features/customers/server/customers"
import { ApiError } from "@/lib/api/server"

export const metadata: Metadata = { title: "Customer details" }

export default async function CustomerDetailsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string | string[] }> }) {
  const validation = z.object({ id: z.uuid() }).safeParse(await params)
  if (!validation.success) notFound()
  const requestedPage = (await searchParams).page
  const parsedPage = Number(Array.isArray(requestedPage) ? requestedPage[0] : requestedPage)
  const historyPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  let customer: Awaited<ReturnType<typeof getCustomerDetails>> | null = null
  try { customer = await getCustomerDetails(validation.data.id, historyPage) } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    if (!(error instanceof CustomersSetupRequiredError)) throw error
  }
  if (!customer) return <CustomersSetupRequired />
  return <div className="space-y-6"><header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-xs text-muted-foreground"><Link className="hover:text-foreground" href="/app/customers">Customers</Link><span>/</span><span>{customer.profile.name}</span></div><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{customer.profile.name}</h1><p className="mt-1 text-sm text-muted-foreground">Customer profile and complete purchase history.</p></div><div className="flex gap-2"><Button render={<Link href="/app/customers" />} variant="outline"><ArrowLeft aria-hidden="true" />Customers</Button><Button render={<Link href={`/app/customers/${customer.profile.id}/edit`} />}><Pencil aria-hidden="true" />Edit</Button></div></header><CustomerDetails data={customer} />{customer.historyTotalCount > customerHistoryPageSize ? <div className="flex items-center justify-between text-sm text-muted-foreground"><p>Showing {(customer.historyPage - 1) * customerHistoryPageSize + 1}–{Math.min(customer.historyPage * customerHistoryPageSize, customer.historyTotalCount)} of {customer.historyTotalCount}</p><div className="flex items-center gap-2"><Button disabled={customer.historyPage <= 1} render={customer.historyPage > 1 ? <Link href={`/app/customers/${customer.profile.id}?page=${customer.historyPage - 1}`} /> : undefined} size="sm" variant="outline"><ChevronLeft aria-hidden="true" />Previous</Button><span>Page {customer.historyPage} of {customer.historyPageCount}</span><Button disabled={customer.historyPage >= customer.historyPageCount} render={customer.historyPage < customer.historyPageCount ? <Link href={`/app/customers/${customer.profile.id}?page=${customer.historyPage + 1}`} /> : undefined} size="sm" variant="outline">Next<ChevronRight aria-hidden="true" /></Button></div></div> : null}</div>
}
