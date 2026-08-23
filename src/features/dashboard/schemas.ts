import { z } from "zod"

const dashboardDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.")
  .refine((value) => {
    const parsedDate = new Date(`${value}T00:00:00Z`)

    return (
      !Number.isNaN(parsedDate.getTime()) &&
      parsedDate.toISOString().slice(0, 10) === value
    )
  }, "Enter a valid date.")

export const dashboardExportSchema = z
  .object({
    endDate: dashboardDate,
    startDate: dashboardDate,
  })
  .refine((dates) => dates.startDate <= dates.endDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  })

export type DashboardExportInput = z.output<typeof dashboardExportSchema>
