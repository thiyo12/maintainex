import type { AdminRole } from './admin-types'

const ROLE_HIERARCHY: Record<AdminRole, number> = {
  SUPER_ADMIN: 6,
  MANAGER: 5,
  FINANCE: 4,
  USER_MANAGEMENT: 3,
  SUPPORT: 2,
  TECHNICAL: 1,
}

export function can(userRole: AdminRole, requiredRoles: AdminRole[]): boolean {
  return requiredRoles.includes(userRole)
}

export function canAtLeast(userRole: AdminRole, minRole: AdminRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole]
}

export const PERMISSION = {
  viewDashboard: ['SUPER_ADMIN', 'MANAGER', 'FINANCE', 'USER_MANAGEMENT', 'SUPPORT', 'TECHNICAL'] as AdminRole[],
  viewKyc: ['SUPER_ADMIN', 'USER_MANAGEMENT'] as AdminRole[],
  approveKyc: ['SUPER_ADMIN', 'USER_MANAGEMENT'] as AdminRole[],
  manageJobs: ['SUPER_ADMIN', 'MANAGER'] as AdminRole[],
  forceCancelJob: ['SUPER_ADMIN', 'MANAGER'] as AdminRole[],
  manageCategories: ['SUPER_ADMIN', 'MANAGER'] as AdminRole[],
  manageUsers: ['SUPER_ADMIN', 'USER_MANAGEMENT'] as AdminRole[],
  suspendUser: ['SUPER_ADMIN', 'USER_MANAGEMENT'] as AdminRole[],
  banUser: ['SUPER_ADMIN', 'USER_MANAGEMENT'] as AdminRole[],
  manageEscrow: ['SUPER_ADMIN', 'FINANCE'] as AdminRole[],
  resolveDisputes: ['SUPER_ADMIN', 'MANAGER', 'SUPPORT'] as AdminRole[],
  exportReports: ['SUPER_ADMIN', 'FINANCE'] as AdminRole[],
  manageAdmins: ['SUPER_ADMIN'] as AdminRole[],
  platformSettings: ['SUPER_ADMIN'] as AdminRole[],
  viewAuditLogs: ['SUPER_ADMIN', 'MANAGER', 'FINANCE', 'USER_MANAGEMENT', 'SUPPORT', 'TECHNICAL'] as AdminRole[],
  viewAllAuditLogs: ['SUPER_ADMIN'] as AdminRole[],
  moderateReviews: ['SUPER_ADMIN', 'USER_MANAGEMENT'] as AdminRole[],
  viewNotifications: ['SUPER_ADMIN', 'MANAGER', 'FINANCE', 'USER_MANAGEMENT', 'SUPPORT', 'TECHNICAL'] as AdminRole[],
} as const
