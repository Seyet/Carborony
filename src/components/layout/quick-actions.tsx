"use client"

import { useState, type ComponentProps } from "react"
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
    permission: "sales.manage",
  },
  {
    title: "Add Product",
    description: "Open your catalogue",
    href: "/app/catalogue",
    icon: PackagePlus,
    permission: "products.manage",
  },
  {
    title: "Add Customer",
    description: "Open customer records",
    href: "/app/customers",
    icon: UserPlus,
    permission: "customers.manage",
  },
  {
    title: "Add Expense",
    description: "Record business spending",
    href: "/app/expenses?new=1",
    icon: ReceiptText,
    permission: "expenses.manage",
  },
] as const

type QuickActionGridProps = {
  className?: string
  onNavigate?: ComponentProps<typeof Link>["onNavigate"]
  permissions?: readonly string[]
}

export function QuickActionGrid({
  className,
  onNavigate,
  permissions,
}: QuickActionGridProps) {
  const accessibleActions = permissions
    ? quickActions.filter((action) => permissions.includes(action.permission))
    : quickActions

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {accessibleActions.map((action) => {
        const Icon = action.icon

        return (
          <Link
            key={action.title}
            href={action.href}
            onNavigate={onNavigate}
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

export function QuickActionsDialog({
  permissions,
}: {
  permissions: readonly string[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
        <QuickActionGrid
          onNavigate={() => setOpen(false)}
          permissions={permissions}
        />
      </DialogContent>
    </Dialog>
  )
}
