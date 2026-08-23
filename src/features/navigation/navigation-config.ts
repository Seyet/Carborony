import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
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
  },
  {
    title: "Sales",
    href: "/app/sales",
    icon: ShoppingCart,
  },
  {
    title: "Catalogue",
    href: "/app/catalogue",
    icon: Package,
  },
  {
    title: "Orders",
    href: "/app/orders",
    icon: ClipboardList,
  },
  {
    title: "Inventory",
    href: "/app/inventory",
    icon: Boxes,
  },
  {
    title: "Customers",
    href: "/app/customers",
    icon: Users,
  },
  {
    title: "Expenses",
    href: "/app/expenses",
    icon: ReceiptText,
  },
  {
    title: "Reports",
    href: "/app/reports",
    icon: BarChart3,
  },
  {
    title: "Marketing",
    href: "/app/marketing",
    icon: Megaphone,
    children: marketingNavigation,
  },
  {
    title: "Staff",
    href: "/app/staff",
    icon: UserRoundCog,
  },
  {
    title: "Settings",
    href: "/app/settings",
    icon: Settings,
  },
]

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
