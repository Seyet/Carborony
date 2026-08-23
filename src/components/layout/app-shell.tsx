import type { ReactNode } from "react"

import { AppSidebar } from "./app-sidebar"
import { MobileNavigation } from "./mobile-navigation"
import type { ShellBusiness, ShellUser } from "./shell-types"
import { TopNavigation } from "./top-navigation"

type AppShellProps = {
  business: ShellBusiness
  children: ReactNode
  user: ShellUser
}

export function AppShell({ business, children, user }: AppShellProps) {
  return (
    <div className="min-h-svh bg-muted/25">
      <AppSidebar business={business} />
      <div className="min-h-svh lg:pl-64">
        <TopNavigation business={business} user={user} />
        <main className="mx-auto w-full max-w-[1600px] p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8 lg:pb-8">
          {children}
        </main>
      </div>
      <MobileNavigation business={business} />
    </div>
  )
}
