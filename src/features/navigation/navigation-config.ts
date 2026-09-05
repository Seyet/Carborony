import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  History,
  Boxes,
  Camera,
  ClipboardList,
  LayoutDashboard,
  Megaphone,
  Package,
  Radio,
  ReceiptText,
  Settings,
  ShoppingCart,
  Sparkles,
  Store,
  Users,
  UserRoundCog,
} from "lucide-react"

export type NavigationChild = {
  title: string
  href: string
  icon: LucideIcon
}

export type NavigationItem = {
  title: string
  href: string
  icon: LucideIcon
  permission?: string
  children?: readonly NavigationChild[]
}

export const marketingNavigation = [
  {
    title: "Instagram",
    href: "/app/marketing/instagram",
    icon: Camera,
  },
  {
    title: "Social Posts",
    href: "/app/marketing/social-posts",
    icon: Radio,
  },
  {
    title: "Campaigns",
    href: "/app/marketing/campaigns",
    icon: Megaphone,
  },
  {
    title: "AI Content",
    href: "/app/marketing/ai-content",
    icon: Sparkles,
  },
] as const satisfies readonly NavigationChild[]

export const primaryNavigation: readonly NavigationItem[] = [
  {
    title: "Dashboard",
    href: "/app/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard.view",
  },
  {
    title: "Sales",
    href: "/app/sales",
    icon: ShoppingCart,
    permission: "sales.view",
  },
  {
    title: "Catalogue",
    href: "/app/catalogue",
    icon: Package,
    permission: "products.view",
  },
  {
    title: "Orders",
    href: "/app/orders",
    icon: ClipboardList,
    permission: "sales.view",
  },
  {
    title: "Inventory",
    href: "/app/inventory",
    icon: Boxes,
    permission: "inventory.view",
  },
  {
    title: "Customers",
    href: "/app/customers",
    icon: Users,
    permission: "customers.view",
  },
  {
    title: "Expenses",
    href: "/app/expenses",
    icon: ReceiptText,
    permission: "expenses.view",
  },
  {
    title: "Reports",
    href: "/app/reports",
    icon: BarChart3,
    permission: "reports.view",
  },
  {
    title: "Activity log",
    href: "/app/activity",
    icon: History,
    permission: "activity.view",
  },
  {
    title: "My Website",
    href: "/app/website",
    icon: Store,
    permission: "settings.view",
  },
  {
    title: "Social Media Tools",
    href: "/app/marketing",
    icon: Megaphone,
    permission: "settings.view",
    children: marketingNavigation,
  },
  {
    title: "Staff",
    href: "/app/staff",
    icon: UserRoundCog,
    permission: "staff.view",
  },
  {
    title: "Settings",
    href: "/app/settings",
    icon: Settings,
    permission: "settings.view",
  },
]

export function canAccessNavigationItem(
  item: NavigationItem,
  permissions: readonly string[],
) {
  return !item.permission || permissions.includes(item.permission)
}

export function isNavigationItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function getCurrentPageTitle(pathname: string) {
  for (const item of primaryNavigation) {
    const child = item.children?.find((entry) => entry.href === pathname)

    if (child) {
      return child.title
    }

    if (isNavigationItemActive(pathname, item.href)) {
      return item.title
    }
  }

  return "Workspace"
}
