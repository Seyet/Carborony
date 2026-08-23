import type { ReactNode } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type AuthCardProps = {
  children: ReactNode
  description: string
  footer: ReactNode
  title: string
}

export function AuthCard({
  children,
  description,
  footer,
  title,
}: AuthCardProps) {
  return (
    <Card className="w-full max-w-md gap-0 rounded-2xl py-0 shadow-xl shadow-foreground/5">
      <CardHeader className="gap-2 px-6 pt-7 pb-6 sm:px-8 sm:pt-8">
        <CardTitle
          as="h1"
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          {title}
        </CardTitle>
        <CardDescription className="text-sm leading-6">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-7 sm:px-8 sm:pb-8">
        {children}
        <div className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">
          {footer}
        </div>
      </CardContent>
    </Card>
  )
}
