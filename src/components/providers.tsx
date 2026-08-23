"use client"

import type { ReactNode } from "react"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

type AppProvidersProps = {
  children: ReactNode
}

function AppProviders({ children }: AppProvidersProps) {
  return (
    <TooltipProvider delay={300}>
      {children}
      <Toaster position="top-right" closeButton richColors />
    </TooltipProvider>
  )
}

export { AppProviders }
