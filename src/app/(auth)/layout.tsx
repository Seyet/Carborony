import type { Metadata } from "next"
import Link from "next/link"
import { Building2, CheckCircle2, ShieldCheck, Store } from "lucide-react"

export const metadata: Metadata = {
  title: {
    default: "Account",
    template: "%s | Carborony",
  },
}

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="relative grid min-h-svh flex-1 bg-muted/30 lg:grid-cols-[minmax(360px,0.85fr)_minmax(520px,1.15fr)]">
      <section className="relative hidden overflow-hidden bg-foreground px-10 py-12 text-background lg:flex lg:flex-col">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:28px_28px]"
        />
        <Link
          className="relative z-10 inline-flex w-fit items-center gap-3 font-semibold tracking-tight"
          href="/"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-background text-foreground">
            <Store aria-hidden="true" className="size-5" />
          </span>
          <span className="text-xl">Carborony</span>
        </Link>

        <div className="relative z-10 my-auto max-w-lg py-20">
          <p className="mb-4 text-sm font-medium text-background/65">
            Your business, connected
          </p>
          <h2 className="text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">
            One clear view of the business you&apos;re building.
          </h2>
          <div className="mt-10 grid gap-5 text-sm text-background/75">
            <div className="flex items-center gap-3">
              <CheckCircle2 aria-hidden="true" className="size-5" />
              Manage daily operations from a single workspace
            </div>
            <div className="flex items-center gap-3">
              <Building2 aria-hidden="true" className="size-5" />
              Ready to support every business you belong to
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck aria-hidden="true" className="size-5" />
              Secure account and tenant-aware data foundation
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-background/50">
          Business management built for modern commerce.
        </p>
      </section>

      <section className="flex min-h-svh flex-col px-4 py-5 sm:px-8 sm:py-8 lg:px-12">
        <Link
          className="inline-flex w-fit items-center gap-2 font-semibold tracking-tight lg:hidden"
          href="/"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
            <Store aria-hidden="true" className="size-4" />
          </span>
          Carborony
        </Link>
        <div className="flex flex-1 items-center justify-center py-8">
          {children}
        </div>
      </section>
    </main>
  )
}
