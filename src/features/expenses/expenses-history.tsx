import {
  Banknote,
  CalendarDays,
  Paperclip,
  ReceiptText,
  UserRound,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ExpensePageData } from "./types"

const paymentMethodLabels: Record<string, string> = {
  bank_transfer: "Bank transfer",
  card: "Card",
  cash: "Cash",
  other: "Other",
  pos: "POS",
}

function formatMoney(currencyCode: string, amount: number) {
  return new Intl.NumberFormat("en", {
    currency: currencyCode,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(amount)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00Z`),
  )
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function paymentLabel(value: string) {
  return paymentMethodLabels[value] ?? value.replaceAll("_", " ")
}

function StatusBadge({ status }: { status: string }) {
  if (status === "recorded") return null

  return (
    <Badge variant={status === "voided" ? "destructive" : "secondary"}>
      {status.replaceAll("_", " ")}
    </Badge>
  )
}

export function ExpensesHistory({
  items,
}: {
  items: ExpensePageData["items"]
}) {
  return (
    <Card className="overflow-hidden py-0 shadow-sm">
      <CardHeader className="border-b py-5">
        <CardTitle as="h2">Expense history</CardTitle>
        <p className="text-sm text-muted-foreground">
          Every recorded business expense, its payment details, and receipt.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y md:hidden">
          {items.map((expense) => (
            <article className="space-y-3 p-4" key={expense.id}>
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <ReceiptText aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-medium">{expense.name}</h3>
                    <StatusBadge status={expense.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {expense.categoryName}
                  </p>
                </div>
                <p className="shrink-0 font-semibold">
                  {formatMoney(expense.currencyCode, expense.amount)}
                </p>
              </div>

              {expense.description ? (
                <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
                  {expense.description}
                </p>
              ) : null}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                  <CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />
                  <dt className="sr-only">Date</dt>
                  <dd className="truncate">{formatDate(expense.date)}</dd>
                </div>
                <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                  <Banknote aria-hidden="true" className="size-3.5 shrink-0" />
                  <dt className="sr-only">Payment method</dt>
                  <dd className="truncate">{paymentLabel(expense.paymentMethod)}</dd>
                </div>
                <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                  <UserRound aria-hidden="true" className="size-3.5 shrink-0" />
                  <dt className="sr-only">Staff member</dt>
                  <dd className="truncate">{expense.staffMemberName ?? "Unassigned"}</dd>
                </div>
                <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                  <Paperclip aria-hidden="true" className="size-3.5 shrink-0" />
                  <dt className="sr-only">Attachment</dt>
                  <dd className="min-w-0 truncate">
                    {expense.attachment ? (
                      <a
                        aria-label={`Download receipt ${expense.attachment.fileName} for ${expense.name}`}
                        className="hover:text-foreground hover:underline"
                        download
                        href={`/api/expenses/${expense.id}/attachment`}
                      >
                        {expense.attachment.fileName}
                      </a>
                    ) : "No receipt"}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>

        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Expense</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Staff member</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead className="pr-6 text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="pl-6">
                    <div className="flex min-w-60 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <ReceiptText aria-hidden="true" className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="block max-w-64 truncate font-medium">
                            {expense.name}
                          </span>
                          <StatusBadge status={expense.status} />
                        </span>
                        <span
                          className="block max-w-72 truncate text-xs text-muted-foreground"
                          title={expense.description ?? undefined}
                        >
                          {expense.description ?? "No description"}
                        </span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{expense.categoryName}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(expense.date)}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {expense.staffMemberName ?? "Unassigned"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {paymentLabel(expense.paymentMethod)}
                  </TableCell>
                  <TableCell>
                    {expense.attachment ? (
                      <a
                        aria-label={`Download receipt ${expense.attachment.fileName} for ${expense.name}`}
                        className="inline-flex max-w-48 items-center gap-1.5 text-muted-foreground"
                        download
                        href={`/api/expenses/${expense.id}/attachment`}
                        title={`${expense.attachment.fileName} · ${formatFileSize(expense.attachment.fileSize)}`}
                      >
                        <Paperclip aria-hidden="true" className="size-3.5 shrink-0" />
                        <span className="truncate hover:text-foreground hover:underline">
                          {expense.attachment.fileName}
                        </span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-6 text-right font-semibold">
                    {formatMoney(expense.currencyCode, expense.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
