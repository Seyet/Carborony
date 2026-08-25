export const staffRoleCodes = [
  "admin",
  "manager",
  "sales",
  "inventory",
  "accountant",
] as const

export type StaffRoleCode = (typeof staffRoleCodes)[number]
export type StaffMemberStatus = "active" | "suspended"
export type StaffRecordStatus =
  | StaffMemberStatus
  | "pending"
  | "expired"
  | "accepted"
  | "revoked"

export type StaffRoleOption = {
  code: StaffRoleCode
  description: string | null
  name: string
  permissions: string[]
}

export type StaffRecord = {
  email: string | null
  expiresAt: string | null
  fullName: string
  id: string
  invitedAt: string
  isCurrentUser: boolean
  joinedAt: string | null
  kind: "member" | "invitation"
  phone: string | null
  roleCode: string
  roleName: string
  status: StaffRecordStatus
  userId: string | null
}

export type StaffPageData = {
  businessId: string
  businessName: string
  canInviteAdmin: boolean
  records: StaffRecord[]
  roles: StaffRoleOption[]
}

export type MyStaffInvitation = {
  businessId: string
  businessName: string
  email: string
  expiresAt: string
  fullName: string
  id: string
  permissions: string[]
  phone: string | null
  requiresPassword: boolean
  roleCode: string
  roleName: string
  status: string
}

export const permissionLabels: Record<string, string> = {
  "customers.manage": "Manage customers",
  "customers.view": "View customers",
  "dashboard.view": "View dashboard",
  "expenses.manage": "Manage expenses",
  "expenses.view": "View expenses",
  "inventory.manage": "Manage inventory",
  "inventory.view": "View inventory",
  "products.manage": "Manage products",
  "products.view": "View products",
  "reports.export": "Export reports",
  "reports.view": "View reports",
  "sales.manage": "Manage sales and orders",
  "sales.view": "View sales and orders",
  "settings.manage": "Manage settings",
  "settings.view": "View settings",
  "staff.manage": "Manage staff",
  "staff.view": "View staff",
}
