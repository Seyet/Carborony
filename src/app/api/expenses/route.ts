import { createExpenseSchema } from "@/features/expenses/schemas"
import { createExpense } from "@/features/expenses/server/create-expense"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request, createExpenseSchema, createExpense)
}
