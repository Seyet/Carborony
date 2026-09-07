"use client"

import { useEffect, useState, type FormEvent } from "react"
import { CheckCircle2, Landmark, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { postJson } from "@/lib/api/client"
import { paymentSetupSchema } from "./schemas"
import type { PaymentBank, PaymentSetupData, VerifiedPaymentAccount } from "./types"

const endpoint = "/api/settings/payments"

export function PaymentSettings() {
  const [setup, setSetup] = useState<PaymentSetupData | null>(null)
  const [banks, setBanks] = useState<PaymentBank[]>([])
  const [loadError, setLoadError] = useState("")
  const [reload, setReload] = useState(0)
  const [bankCode, setBankCode] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [verified, setVerified] = useState<VerifiedPaymentAccount | null>(null)
  const [pending, setPending] = useState<"resolve" | "create" | "refresh" | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      const result = await postJson<PaymentSetupData>(endpoint, { action: "status" }, {
        loading: false,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      if (!result.ok) { setLoadError(result.error.message); return }
      setSetup(result.data)
      setLoadError("")
      if (!result.data.available || !result.data.supported || result.data.account) return
      const bankResult = await postJson<{ banks: PaymentBank[] }>(endpoint, { action: "banks" }, {
        loading: false,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      if (!bankResult.ok) { setLoadError(bankResult.error.message); return }
      setBanks(bankResult.data.banks)
    }
    void load()
    return () => controller.abort()
  }, [reload])

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const input = paymentSetupSchema.safeParse({ action: "resolve", bankCode, accountNumber })
    if (!input.success) { toast.error(input.error.issues[0]?.message); return }
    setPending("resolve")
    const result = await postJson<VerifiedPaymentAccount>(endpoint, input.data)
    setPending(null)
    if (!result.ok) { toast.error(result.error.message); return }
    setVerified(result.data)
    setConfirmOpen(true)
  }

  async function create() {
    if (pending || !verified || !setup) return
    setPending("create")
    const result = await postJson<PaymentSetupData>(endpoint, {
      action: "create", bankCode: verified.bankCode, accountNumber: verified.accountNumber,
      accountName: verified.accountName, commissionPercent: setup.commissionPercent, confirmed: true,
    })
    setPending(null)
    if (!result.ok) {
      toast.error(result.error.message)
      // Re-read durable state after a lost response or concurrent setup attempt.
      setConfirmOpen(false)
      setVerified(null)
      setReload((value) => value + 1)
      return
    }
    setSetup(result.data)
    setAccountNumber("")
    setVerified(null)
    setConfirmOpen(false)
    toast.success(result.message ?? "Payout account saved.")
  }

  async function refreshStatus() {
    if (pending) return
    setPending("refresh")
    const result = await postJson<PaymentSetupData>(endpoint, { action: "refresh" })
    setPending(null)
    if (!result.ok) { toast.error(result.error.message); return }
    setSetup(result.data)
    if (result.message) toast.info(result.message)
    if (!result.data.account) setReload((value) => value + 1)
  }

  if (loadError) return <Card><CardContent className="space-y-4"><p role="alert" className="text-sm text-muted-foreground">{loadError}</p><Button onClick={() => { setLoadError(""); setReload((value) => value + 1) }} variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></CardContent></Card>
  if (!setup) return <Card><CardContent className="flex items-center gap-3 text-sm text-muted-foreground" role="status"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Loading payment settings…</CardContent></Card>
  if (!setup.supported) return <Card><CardHeader><CardTitle>Payments are not available in your region yet</CardTitle><CardDescription>Payout setup currently supports businesses based in Nigeria using NGN.</CardDescription></CardHeader></Card>
  if (!setup.available) return <Card><CardHeader><CardTitle>Payment setup is coming soon</CardTitle><CardDescription>We’re preparing online payments for your business. Please check back later.</CardDescription></CardHeader></Card>

  const account = setup.account
  return <div className="space-y-5">
    {setup.mode === "test" ? <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-800 dark:text-amber-300"><strong>Test mode</strong><p className="mt-1">This setup uses Paystack’s test environment and cannot receive live payouts.</p></div> : null}
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><Landmark aria-hidden="true" className="size-5" />Storefront payouts</CardTitle><Badge variant="outline">Paystack</Badge></div>
        <CardDescription>Add the bank account where your business will receive settlement for online orders.</CardDescription>
      </CardHeader>
      <CardContent>
        {account ? <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-4">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="min-w-0"><p className="font-medium">{account.accountName}</p><p className="mt-1 text-sm text-muted-foreground">{account.bankName} · Account ending {account.accountLastFour}</p><Badge className="mt-3" variant="secondary">{account.status !== "connected" ? "Awaiting confirmation" : !account.providerActive ? "Provider review needed" : "Payout account saved"}</Badge></div>
          </div>
          <p className="text-sm text-muted-foreground">{account.status === "connected"
            ? "Your payout destination is saved. Online checkout is available when this account is active and payment configuration is complete. Contact support if you need to change this account."
            : "We’re confirming your account setup with Paystack. Check the status before trying again. If it stays pending, contact support."}</p>
          <p className="text-sm text-muted-foreground">Carborony platform fee: {account.commissionPercent}%. Payment provider fees apply separately.</p>
          <Button disabled={Boolean(pending)} onClick={refreshStatus} variant="outline">{pending === "refresh" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}Check setup status</Button>
        </div> : <form className="grid max-w-lg gap-5" onSubmit={verify}>
          <label className="grid gap-2 text-sm font-medium" htmlFor="payout-bank">Bank
            <select id="payout-bank" className="h-11 rounded-lg border border-input bg-background px-3 text-sm" disabled={Boolean(pending) || !banks.length} value={bankCode} onChange={(event) => { setBankCode(event.target.value); setVerified(null) }} required>
              <option value="">{banks.length ? "Select your bank" : "Loading banks…"}</option>
              {banks.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium" htmlFor="payout-account">Account number
            <Input id="payout-account" autoComplete="off" inputMode="numeric" maxLength={10} pattern="[0-9]{10}" placeholder="10-digit account number" required disabled={Boolean(pending)} value={accountNumber} onChange={(event) => { setAccountNumber(event.target.value.replace(/\D/g, "")); setVerified(null) }} />
          </label>
          <p className="text-sm leading-6 text-muted-foreground">Carborony platform fee: <strong>{setup.commissionPercent}%</strong>. Payment provider fees apply separately. You’ll review the bank account name before saving.</p>
          <Button className="justify-self-start" disabled={Boolean(pending) || !bankCode || accountNumber.length !== 10} type="submit">{pending === "resolve" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <ShieldCheck aria-hidden="true" />}Verify bank account</Button>
        </form>}
      </CardContent>
    </Card>
    <Dialog open={confirmOpen} onOpenChange={(open) => { if (pending !== "create") setConfirmOpen(open) }}>
      <DialogContent showCloseButton={pending !== "create"}>
        <DialogHeader><DialogTitle>Confirm payout account</DialogTitle><DialogDescription>Check that this is the bank account you want to use for your business payouts.</DialogDescription></DialogHeader>
        {verified ? <dl className="space-y-3 rounded-xl bg-muted/40 p-4 text-sm"><div><dt className="text-muted-foreground">Account name</dt><dd className="mt-1 font-semibold">{verified.accountName}</dd></div><div><dt className="text-muted-foreground">Bank</dt><dd className="mt-1">{verified.bankName}</dd></div><div><dt className="text-muted-foreground">Account number</dt><dd className="mt-1 tabular-nums">{verified.accountNumber}</dd></div><div><dt className="text-muted-foreground">Platform fee</dt><dd className="mt-1">{setup.commissionPercent}% plus applicable provider fees</dd></div></dl> : null}
        <DialogFooter><DialogClose render={<Button disabled={pending === "create"} variant="outline" />}>Go back</DialogClose><Button disabled={Boolean(pending) || !verified} onClick={create}>{pending === "create" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <CheckCircle2 aria-hidden="true" />}Confirm and save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}
