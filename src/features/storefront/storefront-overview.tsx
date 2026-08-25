import {
  CheckCircle2,
  CircleDashed,
  CreditCard,
  Globe2,
  LayoutTemplate,
  PackageSearch,
  Palette,
  Search,
  Store,
  Truck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const managementAreas = [
  {
    description: "Choose your colours, logo, typography, and homepage sections.",
    icon: Palette,
    title: "Store design",
  },
  {
    description: "Decide which products, categories, and collections appear online.",
    icon: PackageSearch,
    title: "Products & collections",
  },
  {
    description: "Build your homepage, navigation, contact, and policy pages.",
    icon: LayoutTemplate,
    title: "Pages & navigation",
  },
  {
    description: "Connect payment methods and configure your checkout experience.",
    icon: CreditCard,
    title: "Payments & checkout",
  },
  {
    description: "Set delivery areas, pickup options, fees, and fulfilment rules.",
    icon: Truck,
    title: "Delivery & pickup",
  },
  {
    description: "Connect a domain and control search titles and descriptions.",
    icon: Search,
    title: "Domain & SEO",
  },
] as const

const launchSteps = [
  { complete: true, label: "Business workspace created" },
  { complete: false, label: "Choose storefront design" },
  { complete: false, label: "Configure checkout and delivery" },
  { complete: false, label: "Review and publish website" },
] as const

export function StorefrontOverview({ businessName }: { businessName: string }) {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Online storefront
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">My Website</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Build and manage the online shopping experience for {businessName}.
          </p>
        </div>
        <Button disabled size="sm" variant="outline">
          <Globe2 aria-hidden="true" />
          Preview website
        </Button>
      </header>

      <Card className="bg-foreground text-background ring-0">
        <CardContent className="grid gap-6 px-5 py-1 sm:px-6 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
            <Badge className="bg-background/10 text-background" variant="secondary">
              Storefront not published
            </Badge>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">
              Turn your catalogue into an online store
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-background/70">
              This workspace will bring design, products, checkout, delivery,
              domain settings, and publishing into one place.
            </p>
          </div>

          <div className="rounded-xl bg-background/8 p-4 ring-1 ring-background/10">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium">Launch checklist</p>
              <span className="text-xs text-background/60">1 of 4 complete</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background/15">
              <div className="h-full w-1/4 rounded-full bg-emerald-400" />
            </div>
            <ul className="mt-4 grid gap-2.5">
              {launchSteps.map((step) => {
                const Icon = step.complete ? CheckCircle2 : CircleDashed

                return (
                  <li
                    className="flex items-center gap-2 text-xs text-background/75"
                    key={step.label}
                  >
                    <Icon
                      aria-hidden="true"
                      className={step.complete ? "size-4 text-emerald-400" : "size-4"}
                    />
                    {step.label}
                  </li>
                )
              })}
            </ul>
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="website-management-heading">
        <div className="mb-3">
          <h2 className="text-base font-semibold" id="website-management-heading">
            Website management
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Everything needed to prepare and operate your storefront.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {managementAreas.map((area) => {
            const Icon = area.icon

            return (
              <Card className="min-h-40" key={area.title} size="sm">
                <CardHeader>
                  <span className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <CardAction>
                    <Badge variant="secondary">Coming soon</Badge>
                  </CardAction>
                  <CardTitle as="h3">{area.title}</CardTitle>
                  <CardDescription className="text-xs leading-5">
                    {area.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          <Store aria-hidden="true" className="size-4" />
        </span>
        <p className="leading-6">
          The module is ready in your workspace. Storefront configuration and
          publishing controls will be added here without changing your existing
          catalogue, inventory, or order workflows.
        </p>
      </div>
    </div>
  )
}
