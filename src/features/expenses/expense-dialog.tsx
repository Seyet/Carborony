"use client"

import {
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react"
import { useRouter } from "next/navigation"
import {
  LoaderCircle,
  Paperclip,
  Plus,
  ReceiptText,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { postJson } from "@/lib/api/client"
import { createClient } from "@/lib/supabase/client"
import type {
  CreateExpenseData,
  PrepareExpenseAttachmentData,
} from "./api-types"
import {
  createExpenseSchema,
  expenseAttachmentMaxBytes,
  expenseAttachmentMimeTypes,
  expenseAttachmentRequestSchema,
} from "./schemas"
import {
  expensePaymentMethods,
  type ExpensePageData,
  type ExpensePaymentMethod,
  type ExpenseStaffOption,
} from "./types"

const paymentMethodLabels: Record<ExpensePaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  card: "Card",
  cash: "Cash",
  other: "Other",
  pos: "POS",
}

type ExpenseDraft = {
  amount: string
  categoryId: string
  description: string
  expenseDate: string
  name: string
  paymentMethod: ExpensePaymentMethod
  staffMemberId: string
}

type DraftField = keyof ExpenseDraft | "attachment"

function initialDraft(todayDate: string): ExpenseDraft {
  return {
    amount: "",
    categoryId: "",
    description: "",
    expenseDate: todayDate,
    name: "",
    paymentMethod: "cash",
    staffMemberId: "",
  }
}

function attachmentError(file: File) {
  const validation = expenseAttachmentRequestSchema.safeParse({
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  })

  return validation.success ? null : validation.error.issues[0]?.message
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ExpenseDialog({
  categories,
  currencyCode,
  initiallyOpen = false,
  staff,
  todayDate,
}: {
  categories: ExpensePageData["categories"]
  currencyCode: string
  initiallyOpen?: boolean
  staff: ExpenseStaffOption[]
  todayDate: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(initiallyOpen)
  const [draft, setDraft] = useState(() => initialDraft(todayDate))
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [pending, setPending] = useState(false)
  const [pendingLabel, setPendingLabel] = useState("Recording expense…")
  const [touched, setTouched] = useState<Set<DraftField>>(new Set())

  const validation = useMemo(() => createExpenseSchema.safeParse({
    amount: draft.amount.trim() === "" ? Number.NaN : Number(draft.amount),
    attachment: null,
    categoryId: draft.categoryId,
    date: draft.expenseDate,
    description: draft.description.trim() || null,
    name: draft.name,
    paymentMethod: draft.paymentMethod,
    staffMemberId: draft.staffMemberId || null,
  }), [draft])

  const errors = useMemo(() => {
    const next: Partial<Record<DraftField, string>> = {}

    if (!validation.success) {
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] === "date" ? "expenseDate" : issue.path[0]
        if (typeof field === "string" && !next[field as DraftField]) {
          next[field as DraftField] = issue.message
        }
      })
    }

    if (draft.expenseDate > todayDate) {
      next.expenseDate = "Expense date cannot be in the future."
    }
    if (!categories.some((category) => category.id === draft.categoryId)) {
      next.categoryId = "Select an expense category."
    }
    if (draft.staffMemberId && !staff.some((member) => member.id === draft.staffMemberId)) {
      next.staffMemberId = "Select a valid staff member."
    }
    if (fileError) next.attachment = fileError
    return next
  }, [
    categories,
    draft.categoryId,
    draft.expenseDate,
    draft.staffMemberId,
    fileError,
    staff,
    todayDate,
    validation,
  ])

  function update<Key extends keyof ExpenseDraft>(
    field: Key,
    value: ExpenseDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [field]: value }))
    setTouched((current) => new Set(current).add(field))
  }

  function reset() {
    setDraft(initialDraft(todayDate))
    setFile(null)
    setFileError(null)
    setFileInputKey((current) => current + 1)
    setTouched(new Set())
    setPendingLabel("Recording expense…")
  }

  function close() {
    if (pending) return
    setOpen(false)
    reset()
    if (initiallyOpen) router.replace("/app/expenses", { scroll: false })
  }

  function chooseAttachment(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0] ?? null
    setTouched((current) => new Set(current).add("attachment"))

    if (!selectedFile) {
      setFile(null)
      setFileError(null)
      return
    }

    const error = attachmentError(selectedFile)
    if (error) {
      setFile(null)
      setFileError(error)
      event.currentTarget.value = ""
      return
    }

    setFile(selectedFile)
    setFileError(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    setTouched(new Set<DraftField>([
      "amount",
      "attachment",
      "categoryId",
      "description",
      "expenseDate",
      "name",
      "paymentMethod",
      "staffMemberId",
    ]))

    if (Object.keys(errors).length > 0 || !validation.success) return

    const expenseInput = validation.data

    setPending(true)

    try {
      let attachment: {
        expenseId: string
        fileName: string
        fileSize: number
        mimeType: string
        storagePath: string
      } | null = null

      if (file) {
        setPendingLabel("Preparing receipt…")
        const preparation = await postJson<PrepareExpenseAttachmentData>(
          "/api/expenses/attachment",
          {
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          },
        )

        if (!preparation.ok) throw new Error(preparation.error.message)
        if (
          !preparation.data.expenseId ||
          !preparation.data.upload?.path ||
          !preparation.data.upload.token
        ) {
          throw new Error("The receipt upload could not be prepared.")
        }

        const storagePath = preparation.data.upload.path
        const supabase = createClient()
        setPendingLabel("Uploading receipt…")
        const upload = await supabase.storage
          .from("expense-attachments")
          .uploadToSignedUrl(
            storagePath,
            preparation.data.upload.token,
            file,
            { contentType: file.type },
          )

        if (upload.error) throw new Error("The receipt could not be uploaded.")

        attachment = {
          expenseId: preparation.data.expenseId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          storagePath,
        }
      }

      setPendingLabel("Recording expense…")
      const response = await postJson<CreateExpenseData>("/api/expenses", {
        ...expenseInput,
        attachment,
      })

      if (!response.ok) throw new Error(response.error.message)

      toast.success(response.message ?? "Expense recorded successfully.")
      setOpen(false)
      reset()

      if (initiallyOpen) router.replace("/app/expenses", { scroll: false })
      else router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The expense could not be recorded.",
      )
    } finally {
      setPending(false)
      setPendingLabel("Recording expense…")
    }
  }

  function errorFor(field: DraftField) {
    return touched.has(field) ? errors[field] : undefined
  }

  const nameError = errorFor("name")
  const categoryError = errorFor("categoryId")
  const amountError = errorFor("amount")
  const dateError = errorFor("expenseDate")
  const paymentError = errorFor("paymentMethod")
  const staffError = errorFor("staffMemberId")
  const descriptionError = errorFor("description")
  const selectedFileError = errorFor("attachment")

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button">
        <Plus aria-hidden="true" />
        Record expense
      </Button>
      <Dialog
        onOpenChange={(nextOpen) => {
          if (nextOpen) setOpen(true)
          else close()
        }}
        open={open}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-hidden sm:max-w-2xl">
          <form className="contents" onSubmit={submit}>
            <DialogHeader>
              <div className="flex items-start gap-3 pr-8">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ReceiptText aria-hidden="true" className="size-5" />
                </span>
                <div className="space-y-1.5">
                  <DialogTitle>Record an expense</DialogTitle>
                  <DialogDescription>
                    Capture business spending and attach a receipt for your records.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="grid min-h-0 gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                Expense name
                <Input
                  aria-invalid={Boolean(nameError) || undefined}
                  autoFocus
                  disabled={pending}
                  maxLength={120}
                  onChange={(event) => update("name", event.currentTarget.value)}
                  placeholder="e.g. August office rent"
                  value={draft.name}
                />
                {nameError ? (
                  <span className="text-xs text-destructive" role="alert">
                    {nameError}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-1.5 text-sm font-medium">
                Category
                <select
                  aria-invalid={Boolean(categoryError) || undefined}
                  className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive"
                  disabled={pending}
                  onChange={(event) => update("categoryId", event.currentTarget.value)}
                  value={draft.categoryId}
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {categoryError ? (
                  <span className="text-xs text-destructive" role="alert">
                    {categoryError}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-1.5 text-sm font-medium">
                Amount ({currencyCode})
                <Input
                  aria-invalid={Boolean(amountError) || undefined}
                  disabled={pending}
                  inputMode="decimal"
                  min="0.0001"
                  onChange={(event) => update("amount", event.currentTarget.value)}
                  placeholder="0.00"
                  max="999999999999"
                  step="0.0001"
                  type="number"
                  value={draft.amount}
                />
                {amountError ? (
                  <span className="text-xs text-destructive" role="alert">
                    {amountError}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-1.5 text-sm font-medium">
                Expense date
                <Input
                  aria-invalid={Boolean(dateError) || undefined}
                  disabled={pending}
                  max={todayDate}
                  min="1900-01-01"
                  onChange={(event) => update("expenseDate", event.currentTarget.value)}
                  type="date"
                  value={draft.expenseDate}
                />
                {dateError ? (
                  <span className="text-xs text-destructive" role="alert">
                    {dateError}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-1.5 text-sm font-medium">
                Payment method
                <select
                  aria-invalid={Boolean(paymentError) || undefined}
                  className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive"
                  disabled={pending}
                  onChange={(event) =>
                    update(
                      "paymentMethod",
                      event.currentTarget.value as ExpensePaymentMethod,
                    )
                  }
                  value={draft.paymentMethod}
                >
                  {expensePaymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {paymentMethodLabels[method]}
                    </option>
                  ))}
                </select>
                {paymentError ? (
                  <span className="text-xs text-destructive" role="alert">
                    {paymentError}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                Staff member
                <select
                  aria-invalid={Boolean(staffError) || undefined}
                  className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive"
                  disabled={pending}
                  onChange={(event) => update("staffMemberId", event.currentTarget.value)}
                  value={draft.staffMemberId}
                >
                  <option value="">No staff member</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} · {member.roleName}
                    </option>
                  ))}
                </select>
                {staffError ? (
                  <span className="text-xs text-destructive" role="alert">
                    {staffError}
                  </span>
                ) : (
                  <span className="text-xs font-normal text-muted-foreground">
                    Assign the expense to the team member responsible for it.
                  </span>
                )}
              </label>

              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                <span>
                  Description{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </span>
                <Textarea
                  aria-invalid={Boolean(descriptionError) || undefined}
                  disabled={pending}
                  maxLength={2_000}
                  onChange={(event) => update("description", event.currentTarget.value)}
                  placeholder="Add context, a reference, or what this expense covered"
                  value={draft.description}
                />
                <span className="flex justify-between gap-3 text-xs font-normal">
                  {descriptionError ? (
                    <span className="text-destructive" role="alert">
                      {descriptionError}
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className="text-muted-foreground">
                    {draft.description.length}/2,000
                  </span>
                </span>
              </label>

              <div className="grid gap-1.5 sm:col-span-2">
                <label className="text-sm font-medium" htmlFor="expense-attachment">
                  Receipt attachment{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Input
                  accept={expenseAttachmentMimeTypes.join(",")}
                  aria-describedby="expense-attachment-help"
                  aria-invalid={Boolean(selectedFileError) || undefined}
                  className="h-auto py-1.5"
                  disabled={pending}
                  id="expense-attachment"
                  key={fileInputKey}
                  onChange={chooseAttachment}
                  type="file"
                />
                {file ? (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">
                    <Paperclip aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                    <Button
                      aria-label="Remove receipt attachment"
                      disabled={pending}
                      onClick={() => {
                        setFile(null)
                        setFileError(null)
                        setFileInputKey((current) => current + 1)
                      }}
                      size="icon-xs"
                      type="button"
                      variant="ghost"
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </div>
                ) : null}
                {selectedFileError ? (
                  <span className="text-xs text-destructive" role="alert">
                    {selectedFileError}
                  </span>
                ) : (
                  <span
                    className="text-xs text-muted-foreground"
                    id="expense-attachment-help"
                  >
                    PDF, JPEG, PNG, or WebP. Maximum{" "}
                    {expenseAttachmentMaxBytes / (1024 * 1024)} MB.
                  </span>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button disabled={pending} onClick={close} type="button" variant="outline">
                Cancel
              </Button>
              <Button disabled={pending || categories.length === 0} type="submit">
                {pending ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <ReceiptText aria-hidden="true" />
                )}
                {pending ? pendingLabel : "Record expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
