"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  Layers3,
  LogOut,
  Search,
  Settings,
  UserRound,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { LogoutConfirmationDialog } from "@/features/auth/components/logout-confirmation-dialog"
import { getCurrentPageTitle } from "@/features/navigation/navigation-config"

import { QuickActionsDialog } from "./quick-actions"
import type { ShellBusiness, ShellUser } from "./shell-types"

function SearchField({ autoFocus = false }: { autoFocus?: boolean }) {
  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(event) => event.preventDefault()}
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        name="global-search"
        aria-label="Search across your business"
        placeholder="Search products, orders, customers…"
        autoFocus={autoFocus}
        className="h-10 bg-muted/55 pl-9 shadow-none"
      />
    </form>
  )
}

function MobileSearch() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-lg" className="md:hidden" />
        }
      >
        <Search aria-hidden="true" />
        <span className="sr-only">Open global search</span>
      </DialogTrigger>
      <DialogContent className="top-24 translate-y-0 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Search your business</DialogTitle>
          <DialogDescription>
            Search products, orders, and customers from one place.
          </DialogDescription>
        </DialogHeader>
        <SearchField autoFocus />
        <p className="text-xs text-muted-foreground">
          Global search is prepared for the modules that will be connected next.
        </p>
      </DialogContent>
    </Dialog>
  )
}

function BusinessSwitcher({ business }: { business: ShellBusiness }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="lg"
            className="max-w-48 gap-2 bg-background px-2.5"
          />
        }
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-[10px] font-semibold text-white">
          {business.initials}
        </span>
        <span className="hidden min-w-0 truncate text-sm sm:block">
          {business.name}
        </span>
        <ChevronDown
          className="hidden size-3.5 text-muted-foreground sm:block"
          aria-hidden="true"
        />
        <span className="sr-only sm:hidden">Open business menu</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Your business</DropdownMenuLabel>
          <DropdownMenuItem className="py-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-xs font-semibold text-white">
              {business.initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {business.name}
              </span>
              <span className="block text-xs text-muted-foreground">
                Current business
              </span>
            </span>
            <Check className="text-emerald-600" aria-hidden="true" />
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Building2 aria-hidden="true" />
          Business switching
          <Badge variant="secondary" className="ml-auto text-[10px]">
            Soon
          </Badge>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NotificationsMenu() {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={<DropdownMenuTrigger render={<Button variant="ghost" size="icon-lg" />} />}
        >
          <span className="relative">
            <Bell aria-hidden="true" />
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-background" />
          </span>
          <span className="sr-only">Open notifications</span>
        </TooltipTrigger>
        <TooltipContent>Notifications</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-80 p-1.5">
        <DropdownMenuGroup>
          <div className="flex items-center justify-between px-2 py-1.5">
            <DropdownMenuLabel className="p-0 text-sm text-foreground">
              Notifications
            </DropdownMenuLabel>
            <Badge variant="secondary">2 new</Badge>
          </div>
          <DropdownMenuSeparator />
          <div className="space-y-0.5">
            <div className="flex items-start gap-2.5 rounded-md px-1.5 py-2.5 text-sm">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-500" />
              <span>
                <span className="block font-medium">Low stock needs attention</span>
                <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                  12 products have reached their stock threshold.
                </span>
              </span>
            </div>
            <div className="flex items-start gap-2.5 rounded-md px-1.5 py-2.5 text-sm">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-sky-500" />
              <span>
                <span className="block font-medium">Orders are waiting</span>
                <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                  3 recent orders are ready for review.
                </span>
              </span>
            </div>
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-center text-xs text-muted-foreground">
          Demo notifications for the foundation preview
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserMenu({
  businessName,
  user,
}: {
  businessName: string
  user: ShellUser
}) {
  const [logoutIsOpen, setLogoutIsOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="lg"
              className="h-10 gap-2 px-1.5 sm:pr-2.5"
            />
          }
        >
          <Avatar>
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
              {user.initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden min-w-0 text-left xl:block">
            <span className="block max-w-28 truncate text-sm font-medium leading-4">
              {user.name}
            </span>
            <span className="block max-w-28 truncate text-[11px] leading-4 text-muted-foreground">
              {user.email}
            </span>
          </span>
          <ChevronDown
            className="hidden size-3.5 text-muted-foreground xl:block"
            aria-hidden="true"
          />
          <span className="sr-only">Open user menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <span className="block truncate text-sm font-medium text-foreground">
                {user.name}
              </span>
              <span className="mt-0.5 block truncate text-xs">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/app/settings" />}>
              <UserRound aria-hidden="true" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/app/settings" />}>
              <Settings aria-hidden="true" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <CircleHelp aria-hidden="true" />
              Help center
              <Badge variant="secondary" className="ml-auto text-[10px]">
                Soon
              </Badge>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            render={
              <button
                className="w-full"
                onClick={() => setLogoutIsOpen(true)}
                type="button"
              />
            }
          >
            <LogOut aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <LogoutConfirmationDialog
        businessName={businessName}
        onOpenChange={setLogoutIsOpen}
        open={logoutIsOpen}
      />
    </>
  )
}

export function TopNavigation({
  business,
  user,
}: {
  business: ShellBusiness
  user: ShellUser
}) {
  const pathname = usePathname()
  const pageTitle = getCurrentPageTitle(pathname)

  return (
    <TooltipProvider>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/92 px-4 backdrop-blur md:px-6 lg:px-8">
        <Link
          href="/app/dashboard"
          className="mr-auto flex shrink-0 items-center gap-2 lg:hidden"
          aria-label="Carborony dashboard"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Layers3 className="size-4" aria-hidden="true" />
          </span>
          <span className="hidden font-semibold tracking-tight sm:block md:hidden">
            Carborony
          </span>
        </Link>

        <div className="mr-auto hidden min-w-32 lg:block">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Workspace
          </p>
          <p className="truncate text-sm font-semibold">{pageTitle}</p>
        </div>

        <div className="hidden w-full max-w-xl flex-1 md:block">
          <SearchField />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          <div className="hidden xl:block">
            <QuickActionsDialog />
          </div>
          <BusinessSwitcher business={business} />
          <MobileSearch />
          <NotificationsMenu />
          <UserMenu businessName={business.name} user={user} />
        </div>
      </header>
    </TooltipProvider>
  )
}
