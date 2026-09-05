"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ClipboardList,
  Ellipsis,
  Home,
  Package,
  ShoppingCart,
} from "lucide-react"
import { useState } from "react"

import { AppLogo } from "@/components/common/app-logo"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  canAccessNavigationItem,
  isNavigationItemActive,
  marketingNavigation,
  primaryNavigation,
} from "@/features/navigation/navigation-config"

import { QuickActionGrid } from "./quick-actions"
import type { ShellBusiness } from "./shell-types"

const bottomNavigation = [
  { title: "Home", href: "/app/dashboard", icon: Home, permission: "dashboard.view" },
  { title: "Sales", href: "/app/sales", icon: ShoppingCart, permission: "sales.view" },
  { title: "Catalogue", href: "/app/catalogue", icon: Package, permission: "products.view" },
  { title: "Orders", href: "/app/orders", icon: ClipboardList, permission: "sales.view" },
] as const

export function MobileNavigation({ business }: { business: ShellBusiness }) {
  const pathname = usePathname()
  const [moreIsOpen, setMoreIsOpen] = useState(false)
  const accessibleBottomNavigation = bottomNavigation.filter((item) =>
    business.permissions.includes(item.permission),
  )
  const primaryTabIsActive = accessibleBottomNavigation.some((item) =>
    isNavigationItemActive(pathname, item.href)
  )
  const moreIsActive = !primaryTabIsActive
  const accessibleNavigation = primaryNavigation.filter((item) =>
    canAccessNavigationItem(item, business.permissions),
  )

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_-24px_rgba(0,0,0,0.35)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-xl grid-cols-5 px-2">
        {accessibleBottomNavigation.map((item) => {
          const Icon = item.icon
          const isActive = isNavigationItemActive(pathname, item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-6 min-w-8 items-center justify-center rounded-full px-2 transition-colors",
                  isActive && "bg-primary/10"
                )}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
              </span>
              <span className="truncate">{item.title}</span>
            </Link>
          )
        })}

        <Sheet open={moreIsOpen} onOpenChange={setMoreIsOpen}>
          <SheetTrigger
            className={cn(
              "group flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              moreIsActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span
              className={cn(
                "flex h-6 min-w-8 items-center justify-center rounded-full px-2 transition-colors",
                moreIsActive && "bg-primary/10"
              )}
            >
              <Ellipsis className="size-[18px]" aria-hidden="true" />
            </span>
            <span>More</span>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[88svh] overflow-y-auto rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <SheetHeader className="border-b pb-4">
              <div className="flex items-center gap-3 pr-8">
                <AppLogo className="size-9" />
                <span className="text-left">
                  <SheetTitle>More from Carborony</SheetTitle>
                  <SheetDescription>
                    Navigate your workspace or start a quick action.
                  </SheetDescription>
                </span>
              </div>
            </SheetHeader>

            <div className="px-4">
              <div className="mb-5 flex items-center gap-3 rounded-xl border bg-muted/35 p-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-600 text-sm font-semibold text-white">
                  {business.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {business.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Current business
                  </span>
                </span>
                <Badge variant="secondary">{business.roleName}</Badge>
              </div>

              <section aria-labelledby="quick-actions-heading">
                <h2
                  id="quick-actions-heading"
                  className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Quick actions
                </h2>
                <QuickActionGrid
                  className="sm:grid-cols-4"
                  onNavigate={() => setMoreIsOpen(false)}
                  permissions={business.permissions}
                />
              </section>

              <section className="mt-6" aria-labelledby="more-navigation-heading">
                <h2
                  id="more-navigation-heading"
                  className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  All modules
                </h2>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {accessibleNavigation.map((item) => {
                    const Icon = item.icon
                    const isActive = isNavigationItemActive(pathname, item.href)

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMoreIsOpen(false)}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        )}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                        {item.title}
                      </Link>
                    )
                  })}
                </div>
              </section>

              <section
                className="mt-6"
                aria-labelledby="marketing-navigation-heading"
              >
                <h2
                  id="marketing-navigation-heading"
                  className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Social Media Tools
                </h2>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                  {marketingNavigation.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMoreIsOpen(false)}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        )}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                        {item.title}
                      </Link>
                    )
                  })}
                </div>
              </section>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
