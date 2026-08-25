export type CreateExpenseData = {
  expenseId: string
}

export type PrepareExpenseAttachmentData = {
  expenseId: string
  upload: {
    path: string
    token: string
  }
}
