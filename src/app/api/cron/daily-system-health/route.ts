import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type Check = { name: string; status: "healthy" | "unhealthy" | "not configured"; detail: string }

async function timedCheck(name: string, run: () => Promise<string>): Promise<Check> {
  try {
    return { name, status: "healthy", detail: await run() }
  } catch (error) {
    return {
      name,
      status: "unhealthy",
      detail: error instanceof Error ? error.message : "Check failed",
    }
  }
}

async function sendReport(checks: Check[], timestamp: string) {
  const apiKey = process.env.RESEND_API_KEY
  const sender = process.env.HEALTH_REPORT_FROM
  const recipient = process.env.HEALTH_REPORT_TO ?? "hellocarborony@gmail.com"
  if (!apiKey || !sender) throw new Error("Set RESEND_API_KEY and HEALTH_REPORT_FROM to enable email reports.")

  const failed = checks.filter((check) => check.status === "unhealthy")
  const subject = `${failed.length ? "ALERT" : "OK"}: Carborony system health — ${timestamp.slice(0, 10)}`
  const rows = checks.map((check) =>
    `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(check.name)}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(check.status.toUpperCase())}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(check.detail)}</td></tr>`,
  ).join("")
  const html = `<h2>Carborony daily system health report</h2><p>Checked at ${escapeHtml(timestamp)} UTC. Overall status: <strong>${failed.length ? "ATTENTION REQUIRED" : "HEALTHY"}</strong>.</p><table style="border-collapse:collapse;text-align:left"><thead><tr><th style="padding:8px">System</th><th style="padding:8px">Status</th><th style="padding:8px">Details</th></tr></thead><tbody>${rows}</tbody></table>`
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: sender, to: [recipient], subject, html }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Email provider returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`)
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character)
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const timestamp = new Date().toISOString().replace("T", " ").replace("Z", "")
  let supabase: ReturnType<typeof createAdminClient> | null = null
  try {
    supabase = createAdminClient()
  } catch {
    // Report missing or invalid Supabase configuration as an unhealthy service.
  }

  const checks: Check[] = [
    { name: "Application", status: "healthy", detail: `Cron endpoint executed on ${process.env.VERCEL_ENV ?? "configured runtime"}` },
  ]

  if (!supabase) {
    checks.push({ name: "Supabase configuration", status: "unhealthy", detail: "Supabase admin client could not be initialized" })
  } else {
    const admin = supabase
    const [database, auth, storage] = await Promise.all([
      timedCheck("Supabase database", async () => {
        const { error } = await admin.from("profiles").select("id", { head: true, count: "exact" })
        if (error) throw new Error(error.message)
        return "Database query succeeded"
      }),
      timedCheck("Supabase Auth", async () => {
        const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
        if (error) throw new Error(error.message)
        return "Admin API responded"
      }),
      timedCheck("Supabase Storage", async () => {
        const { error } = await admin.storage.listBuckets()
        if (error) throw new Error(error.message)
        return "Storage API responded"
      }),
    ])
    checks.push(database, auth, storage)
  }

  const paystackConfigured = Boolean(process.env.PAYSTACK_SECRET_KEY)
  checks.push({
    name: "Paystack configuration",
    status: paystackConfigured ? "healthy" : "not configured",
    detail: paystackConfigured ? "Secret is configured; live transaction processing is not probed" : "PAYSTACK_SECRET_KEY is not configured",
  })
  const instagramConfigured = Boolean(process.env.META_INSTAGRAM_APP_ID && process.env.META_INSTAGRAM_APP_SECRET)
  checks.push({
    name: "Instagram integration configuration",
    status: instagramConfigured ? "healthy" : "not configured",
    detail: instagramConfigured ? "App credentials are configured; connected account tokens are not probed" : "Meta app credentials are not configured",
  })

  try {
    await sendReport(checks, timestamp)
  } catch (error) {
    console.error("Daily system health report email failed", error)
    return Response.json({ ok: false, checks, error: error instanceof Error ? error.message : "Email delivery failed" }, { status: 502 })
  }

  return Response.json({ ok: true, checks, sentTo: process.env.HEALTH_REPORT_TO ?? "hellocarborony@gmail.com" })
}
