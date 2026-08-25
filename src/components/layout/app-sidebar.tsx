"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronDown,
  LogOut,
} from "lucide-react"
import { useState } from "react"

import { AppLogo } from "@/components/common/app-logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { LogoutConfirmationDialog } from "@/features/auth/components/logout-confirmation-dialog"
import { cn } from "@/lib/utils"
import {
  canAccessNavigationItem,
  isNavigationItemActive,
  primaryNavigation,
} from "@/features/navigation/navigation-config"

import type { ShellBusiness } from "./shell-types"

export function AppSidebar({ business }: { business: ShellBusiness }) {
  const pathname = usePathname()
  const marketingIsActive = pathname.startsWith("/app/marketing")
  const [marketingIsOpen, setMarketingIsOpen] = useState(marketingIsActive)
  const [logoutIsOpen, setLogoutIsOpen] = useState(false)
  const accessibleNavigation = primaryNavigation.filter((item) =>
    canAccessNavigationItem(item, business.permissions),
  )

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-5">
        <AppLogo className="size-9" />
        <span className="min-w-0">
          <span className="block truncate text-base font-semibold tracking-tight">
            Carborony
          </span>
          <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Business OS
          </span>
        </span>
      </div>

      <div className="px-3 pt-4">
        <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/55 p-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-sm font-semibold text-white">
              {business.initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {business.name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                Current business
              </span>
            </span>
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              {business.roleName}
            </Badge>
          </div>
        </div>
      </div>

      <nav
        aria-label="Primary navigation"
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
      >
        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Workspace
        </p>
        <ul className="space-y-1">
          {accessibleNavigation.map((item) => {
            const Icon = item.icon
            const isActive = isNavigationItemActive(pathname, item.href)
            const hasChildren = Boolean(item.children?.length)
            const showChildren =
              hasChildren && (marketingIsOpen || marketingIsActive)

            return (
              <li key={item.href}>
                <div className="flex items-center gap-1">
                  <Link
                    href={item.href}
                    aria-current={pathname === item.href ? "page" : undefined}
                    className={cn(
                      "group flex h-9 min-w-0 flex-1 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-xs"
                        : "text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        !isActive &&
                          "text-muted-foreground group-hover:text-sidebar-accent-foreground"
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.title}</span>
                  </Link>
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={() => setMarketingIsOpen((value) => !value)}
                      aria-label={
                        showChildren
                          ? "Collapse marketing navigation"
                          : "Expand marketing navigation"
                      }
                      aria-expanded={showChildren}
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                    >
                      <ChevronDown
                        className={cn(
                          "size-4 transition-transform",
                          showChildren && "rotate-180"
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  ) : null}
                </div>

                {showChildren && item.children ? (
                  <ul className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-3">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon
                      const childIsActive = pathname === child.href

                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            aria-current={childIsActive ? "page" : undefined}
                            className={cn(
                              "flex h-8 items-center gap-2.5 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                              childIsActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                          >
                            <ChildIcon className="size-3.5" aria-hidden="true" />
                            {child.title}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="shrink-0 p-3 pt-0">
        <Separator className="mb-3" />
        {/* <Link
          href="/app/settings"
          className="group flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-background ring-1 ring-sidebar-border">
            <CircleHelp className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-sidebar-foreground">
              Need help?
            </span>
            <span className="block text-xs">Visit settings</span>
          </span>
          <ExternalLink
            className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        </Link> */}
        <Button
          variant="ghost"
          className="mt-1 h-auto w-full justify-start gap-3 px-2.5 py-2.5 text-left text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setLogoutIsOpen(true)}
          type="button"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-destructive/10">
            <LogOut className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Sign out</span>
            <span className="block text-xs text-muted-foreground">
              Sign out of your account
            </span>
          </span>
        </Button>
        <LogoutConfirmationDialog
          businessName={business.name}
          onOpenChange={setLogoutIsOpen}
          open={logoutIsOpen}
        />
      </div>
    </aside>
  )
}
