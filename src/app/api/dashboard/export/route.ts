import { dashboardExportSchema } from "@/features/dashboard/schemas"
import { exportDashboardOverview } from "@/features/dashboard/server/export-overview"
import { handleJsonPost } from "@/lib/api/server"

export async function POST(request: Request) {
  return handleJsonPost(request, dashboardExportSchema, exportDashboardOverview)
}
