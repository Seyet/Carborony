import type { ReactNode } from "react"

import { ModuleTutorial } from "@/features/tutorials/module-tutorial"
import type { TutorialProgress } from "@/features/tutorials/guides"

import { AppSidebar } from "./app-sidebar"
import { MobileNavigation } from "./mobile-navigation"
import type { ShellBusiness, ShellUser } from "./shell-types"
import { TopNavigation } from "./top-navigation"

type AppShellProps = {
  business: ShellBusiness
  children: ReactNode
  user: ShellUser
  tutorialProgress: TutorialProgress
}

export function AppShell({ business, children, user, tutorialProgress }: AppShellProps) {
  return (
    <div className="min-h-svh bg-background">
      <AppSidebar business={business} />
      <div className="min-h-svh lg:pl-64">
        <TopNavigation business={business} user={user} />
        <main className="mx-auto w-full max-w-[1600px] p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8 lg:pb-8">
          <ModuleTutorial progress={tutorialProgress} permissions={business.permissions} />
          {children}
        </main>
      </div>
      <MobileNavigation business={business} />
    </div>
  )
}
