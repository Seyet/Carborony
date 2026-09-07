"use client"

import type { ReactNode } from "react"

import { GlobalLoadingProvider } from "@/components/common/global-loading-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

type AppProvidersProps = {
  children: ReactNode
}

function AppProviders({ children }: AppProvidersProps) {
  return (
    <GlobalLoadingProvider>
      <TooltipProvider delay={300}>
        {children}
        <Toaster position="top-right" closeButton richColors />
      </TooltipProvider>
    </GlobalLoadingProvider>
  )
}

export { AppProviders }
