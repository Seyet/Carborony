import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CustomerForm } from "@/features/customers/customer-form"

export const metadata: Metadata = { title: "Add customer" }

export default function NewCustomerPage() {
  return <div className="space-y-6"><header><Button render={<Link href="/app/customers" />} size="sm" variant="ghost"><ArrowLeft aria-hidden="true" />Customers</Button><h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Add customer</h1><p className="mt-1 text-sm text-muted-foreground">Create a customer profile for future sales, orders, and relationship management.</p></header><CustomerForm /></div>
}
