import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { getTransactionDocument } from "@/features/sales/documents/server/get-transaction-document"
import type { TransactionDocumentData } from "@/features/sales/documents/types"
import { TransactionDetails } from "@/features/sales/history/transaction-details"
import { TransactionDocumentButton } from "@/features/sales/history/transaction-document-button"
import { MarkInvoicePaidButton } from "@/features/sales/invoices/mark-invoice-paid-button"
import { ApiError } from "@/lib/api/server"

export const metadata: Metadata = { title: "Transaction details" }

const paramsSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["invoice", "sale"]),
})

type TransactionDetailsPageProps = {
  params: Promise<{ id: string; kind: string }>
}

export default async function TransactionDetailsPage({ params }: TransactionDetailsPageProps) {
  const validation = paramsSchema.safeParse(await params)
  if (!validation.success) notFound()

  let transaction: TransactionDocumentData | null = null
  try {
    transaction = await getTransactionDocument(validation.data.kind, validation.data.id)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  if (!transaction) notFound()

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Sales</span><span aria-hidden="true">/</span><Link className="hover:text-foreground" href="/app/sales/history">History</Link><span aria-hidden="true">/</span><span className="text-foreground">{transaction.number}</span></div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{transaction.kind === "invoice" ? "Invoice" : "Sale"} details</h1>
          <p className="mt-1 text-sm text-muted-foreground">{transaction.number}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button render={<Link href="/app/sales/history" />} variant="outline"><ArrowLeft aria-hidden="true" />Sales history</Button>
          <TransactionDocumentButton documentNumber={transaction.number} id={transaction.id} kind={transaction.kind} />
          {transaction.kind === "invoice" && transaction.paymentStatus !== "paid" && transaction.paymentStatus !== "refunded" && transaction.status !== "cancelled" ? <MarkInvoicePaidButton currentPaymentMethod={transaction.paymentMethod} invoiceId={transaction.id} invoiceNumber={transaction.number} /> : null}
        </div>
      </header>

      <TransactionDetails data={transaction} />
    </div>
  )
}
