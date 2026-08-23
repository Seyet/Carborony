"use client"

import Link from "next/link"
import {
  PackagePlus,
  Plus,
  ReceiptText,
  ShoppingCart,
  UserPlus,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const quickActions = [
  {
    title: "Add Sale",
    description: "Open the sales workspace",
    href: "/app/sales",
    icon: ShoppingCart,
  },
  {
    title: "Add Product",
    description: "Open your catalogue",
    href: "/app/catalogue",
    icon: PackagePlus,
  },
  {
    title: "Add Customer",
    description: "Open customer records",
    href: "/app/customers",
    icon: UserPlus,
  },
  {
    title: "Add Expense",
    description: "Open expense tracking",
    href: "/app/expenses",
    icon: ReceiptText,
  },
] as const

type QuickActionGridProps = {
  className?: string
  onNavigate?: React.MouseEventHandler<HTMLAnchorElement>
}

export function QuickActionGrid({
  className,
  onNavigate,
}: QuickActionGridProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {quickActions.map((action) => {
        const Icon = action.icon

        return (
          <Link
            key={action.title}
            href={action.href}
            onClick={onNavigate}
            className="group flex min-h-28 flex-col justify-between rounded-xl border bg-background p-3.5 text-left transition-colors hover:border-foreground/20 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/8 text-primary transition-transform group-hover:-translate-y-0.5">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-medium text-foreground">
                {action.title}
              </span>
              <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                {action.description}
              </span>
            </span>
          </Link>
        )
      })}
    </div>
  )
}

export function QuickActionsDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="lg" />}>
        <Plus data-icon="inline-start" aria-hidden="true" />
        Quick add
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick actions</DialogTitle>
          <DialogDescription>
            Jump to the workspace for the record you want to create.
          </DialogDescription>
        </DialogHeader>
        <QuickActionGrid />
        
      </DialogContent>
    </Dialog>
  )
}
