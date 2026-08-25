import type { Metadata } from "next"
import Form from "next/form"
import { ArrowLeft, ChevronLeft, ChevronRight, ReceiptText, Search, X } from "lucide-react"

import { EmptyState } from "@/components/common"
import { Button, ButtonLink } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PosSetupRequired } from "@/features/sales/pos/pos-setup-required"
import { PosSetupRequiredError } from "@/features/sales/pos/server/get-pos-catalog"
import {
  getSalesHistory,
  salesHistoryPageSize,
  type SalesHistoryResult,
} from "@/features/sales/history/server/get-sales-history"
import { SalesHistoryTable } from "@/features/sales/history/sales-history-table"

export const metadata: Metadata = { title: "Sales history" }

type SalesHistoryPageProps = {
  searchParams: Promise<{
    page?: string | string[]
    query?: string | string[]
  }>
}

function getFirstSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

function getHistoryHref(page: number, searchQuery: string) {
  const params = new URLSearchParams()

  if (searchQuery) params.set("query", searchQuery)
  if (page > 1) params.set("page", String(page))

  const queryString = params.toString()
  return `/app/sales/history${queryString ? `?${queryString}` : ""}`
}

export default async function SalesHistoryPage({ searchParams }: SalesHistoryPageProps) {
  const resolvedSearchParams = await searchParams
  const parsedPage = Number(getFirstSearchParam(resolvedSearchParams.page))
  const requestedPage = Number.isSafeInteger(parsedPage) && parsedPage > 0
    ? parsedPage
    : 1
  const searchQuery = (getFirstSearchParam(resolvedSearchParams.query) ?? "")
    .trim()
    .slice(0, 100)
  let history: SalesHistoryResult | null = null
  let setupRequired = false

  try {
    history = await getSalesHistory(requestedPage, searchQuery)
  } catch (error) {
    if (error instanceof PosSetupRequiredError) setupRequired = true
    else throw error
  }

  if (setupRequired || !history) return <PosSetupRequired />

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Sales</span><span aria-hidden="true">/</span><span className="text-foreground">History</span></div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Sales history</h1>
          <p className="mt-1 text-sm text-muted-foreground">View completed sales and created invoices, then download their PDF documents.</p>
        </div>
        <ButtonLink href="/app/sales" variant="outline"><ArrowLeft aria-hidden="true" />New sale</ButtonLink>
      </header>

      <Form action="/app/sales/history" className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 pl-9"
            defaultValue={searchQuery}
            maxLength={100}
            name="query"
            placeholder="Search document number, buyer, phone, payment or status"
            type="search"
          />
        </div>
        <Button className="h-10" type="submit">
          <Search aria-hidden="true" />Search
        </Button>
        {searchQuery ? (
          <ButtonLink className="h-10" href="/app/sales/history" variant="outline">
            <X aria-hidden="true" />Clear
          </ButtonLink>
        ) : null}
      </Form>

      {history.items.length ? (
        <>
          <SalesHistoryTable items={history.items} />
          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {(history.page - 1) * salesHistoryPageSize + 1}–{Math.min(history.page * salesHistoryPageSize, history.totalCount)} of {history.totalCount} {history.totalCount === 1 ? "transaction" : "transactions"}
              {searchQuery ? ` matching “${searchQuery}”` : ""}
            </p>
            <div className="flex items-center gap-2">
              {history.page > 1 ? (
                <ButtonLink href={getHistoryHref(history.page - 1, searchQuery)} size="sm" variant="outline"><ChevronLeft aria-hidden="true" />Previous</ButtonLink>
              ) : (
                <Button disabled size="sm" variant="outline"><ChevronLeft aria-hidden="true" />Previous</Button>
              )}
              <span className="px-2">Page {history.page} of {history.pageCount}</span>
              {history.page < history.pageCount ? (
                <ButtonLink href={getHistoryHref(history.page + 1, searchQuery)} size="sm" variant="outline">Next<ChevronRight aria-hidden="true" /></ButtonLink>
              ) : (
                <Button disabled size="sm" variant="outline">Next<ChevronRight aria-hidden="true" /></Button>
              )}
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          action={searchQuery
            ? <ButtonLink href="/app/sales/history" variant="outline">Clear search</ButtonLink>
            : <ButtonLink href="/app/sales">Create a transaction</ButtonLink>}
          description={searchQuery
            ? `No transactions match “${searchQuery}”. Try a different search.`
            : "Completed sales and created invoices will appear here."}
          icon={ReceiptText}
          title={searchQuery ? "No matching transactions" : "No sales history yet"}
        />
      )}
    </div>
  )
}
