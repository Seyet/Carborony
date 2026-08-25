import type { Metadata } from "next"
import Form from "next/form"
import {
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  ReceiptText,
  Search,
  X,
} from "lucide-react"

import { EmptyState } from "@/components/common"
import { Button, ButtonLink } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ExpenseDialog } from "@/features/expenses/expense-dialog"
import { ExpenseMetricCards } from "@/features/expenses/expense-metrics"
import { ExpensesHistory } from "@/features/expenses/expenses-history"
import { ExpensesSetupRequired } from "@/features/expenses/expenses-setup-required"
import { getCurrentBusiness } from "@/features/businesses/server/get-current-business"
import {
  ExpensesSetupRequiredError,
  expensesPageSize,
  getExpensesPageData,
} from "@/features/expenses/server/get-expenses"
import {
  expensePaymentMethods,
  type ExpensePageData,
  type ExpensePaymentMethod,
} from "@/features/expenses/types"

export const metadata: Metadata = { title: "Expenses" }

const paymentMethodLabels: Record<ExpensePaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  card: "Card",
  cash: "Cash",
  other: "Other",
  pos: "POS",
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ExpensesPageProps = {
  searchParams: Promise<{
    category?: string | string[]
    new?: string | string[]
    page?: string | string[]
    payment?: string | string[]
    query?: string | string[]
  }>
}

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

function expensesHref({
  categoryId,
  page,
  paymentMethod,
  query,
}: {
  categoryId: string
  page: number
  paymentMethod: string
  query: string
}) {
  const params = new URLSearchParams()
  if (query) params.set("query", query)
  if (categoryId) params.set("category", categoryId)
  if (paymentMethod) params.set("payment", paymentMethod)
  if (page > 1) params.set("page", String(page))
  const queryString = params.toString()
  return `/app/expenses${queryString ? `?${queryString}` : ""}`
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = await searchParams
  const parsedPage = Number(first(params.page))
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const query = (first(params.query) ?? "").trim().slice(0, 100)
  const requestedCategoryId = (first(params.category) ?? "").trim()
  const categoryId = uuidPattern.test(requestedCategoryId) ? requestedCategoryId : ""
  const requestedPaymentMethod = first(params.payment) ?? ""
  const paymentMethod = expensePaymentMethods.some(
    (method) => method === requestedPaymentMethod,
  )
    ? requestedPaymentMethod
    : ""
  const initiallyOpen = first(params.new) === "1"

  let expenses: ExpensePageData
  try {
    expenses = await getExpensesPageData({
      categoryId,
      page,
      paymentMethod,
      query,
    })
  } catch (error) {
    if (error instanceof ExpensesSetupRequiredError) {
      return <ExpensesSetupRequired />
    }
    throw error
  }

  const business = await getCurrentBusiness()
  const canRecordExpenses = business.roleName === "Owner"
  const hasFilters = Boolean(query || categoryId || paymentMethod)
  const filters = { categoryId, paymentMethod, query }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Finance / Expenses</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Expenses
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record business spending, assign it to your team, and keep receipts organised.
          </p>
        </div>
        {canRecordExpenses ? (
          <ExpenseDialog
            categories={expenses.categories}
            currencyCode={expenses.currencyCode}
            initiallyOpen={initiallyOpen}
            key={initiallyOpen ? "expense-dialog-open" : "expense-dialog-closed"}
            staff={expenses.staffMembers}
            todayDate={expenses.todayDate}
          />
        ) : (
          <div className="flex max-w-sm items-start gap-2 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
            <LockKeyhole aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <strong className="font-medium text-foreground">Read-only access.</strong>{" "}
              Only the business owner can record expenses.
            </span>
          </div>
        )}
      </header>

      <ExpenseMetricCards
        currencyCode={expenses.currencyCode}
        metrics={expenses.metrics}
      />

      <Form
        action="/app/expenses"
        className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_220px_180px_auto_auto]"
      >
        <div className="relative sm:col-span-2 xl:col-span-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="h-10 pl-9"
            defaultValue={query}
            maxLength={100}
            name="query"
            placeholder="Search expense name, description, or staff"
            type="search"
          />
        </div>
        <select
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          defaultValue={categoryId}
          name="category"
        >
          <option value="">All categories</option>
          {expenses.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          defaultValue={paymentMethod}
          name="payment"
        >
          <option value="">All payment methods</option>
          {expensePaymentMethods.map((method) => (
            <option key={method} value={method}>
              {paymentMethodLabels[method]}
            </option>
          ))}
        </select>
        <Button className="h-10" type="submit">
          <Search aria-hidden="true" />
          Filter
        </Button>
        {hasFilters ? (
          <ButtonLink className="h-10" href="/app/expenses" variant="outline">
            <X aria-hidden="true" />
            Clear
          </ButtonLink>
        ) : null}
      </Form>

      {expenses.items.length ? (
        <>
          <ExpensesHistory items={expenses.items} />
          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {(expenses.page - 1) * expensesPageSize + 1}–
              {Math.min(expenses.page * expensesPageSize, expenses.totalCount)} of{" "}
              {expenses.totalCount} expenses
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {expenses.page > 1 ? (
                <ButtonLink
                  href={expensesHref({ ...filters, page: expenses.page - 1 })}
                  size="sm"
                  variant="outline"
                >
                  <ChevronLeft aria-hidden="true" />
                  Previous
                </ButtonLink>
              ) : (
                <Button disabled size="sm" variant="outline">
                  <ChevronLeft aria-hidden="true" />
                  Previous
                </Button>
              )}
              <span className="px-1 sm:px-2">
                Page {expenses.page} of {expenses.pageCount}
              </span>
              {expenses.page < expenses.pageCount ? (
                <ButtonLink
                  href={expensesHref({ ...filters, page: expenses.page + 1 })}
                  size="sm"
                  variant="outline"
                >
                  Next
                  <ChevronRight aria-hidden="true" />
                </ButtonLink>
              ) : (
                <Button disabled size="sm" variant="outline">
                  Next
                  <ChevronRight aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          action={
            hasFilters ? (
              <ButtonLink href="/app/expenses" variant="outline">
                Clear filters
              </ButtonLink>
            ) : canRecordExpenses ? (
              <ButtonLink href="/app/expenses?new=1">Record an expense</ButtonLink>
            ) : undefined
          }
          description={
            hasFilters
              ? "No expenses match the selected filters."
              : "Record rent, salaries, utilities, inventory costs, and other business spending here."
          }
          icon={ReceiptText}
          title={hasFilters ? "No matching expenses" : "No expenses yet"}
        />
      )}
    </div>
  )
}
