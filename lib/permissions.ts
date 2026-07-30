import type { AdminRole } from './admin-types'

const ROLE_HIERARCHY: Record<AdminRole, number> = {
  SUPER_ADMIN: 5,
  OPERATIONS: 4,
  FINANCE: 3,
  MODERATOR: 2,
  SUPPORT: 1,
}

export function can(userRole: AdminRole, requiredRoles: AdminRole[]): boolean {
  return requiredRoles.includes(userRole)
}

export function canAtLeast(userRole: AdminRole, minRole: AdminRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole]
}

export const PERMISSION = {
  viewDashboard: ['SUPER_ADMIN', 'OPERATIONS', 'FINANCE', 'MODERATOR', 'SUPPORT'] as AdminRole[],
  viewKyc: ['SUPER_ADMIN', 'OPERATIONS', 'MODERATOR'] as AdminRole[],
  approveKyc: ['SUPER_ADMIN', 'OPERATIONS', 'MODERATOR'] as AdminRole[],
  manageJobs: ['SUPER_ADMIN', 'OPERATIONS', 'MODERATOR'] as AdminRole[],
  forceCancelJob: ['SUPER_ADMIN', 'OPERATIONS'] as AdminRole[],
  manageCategories: ['SUPER_ADMIN', 'OPERATIONS', 'MODERATOR'] as AdminRole[],
  manageUsers: ['SUPER_ADMIN', 'OPERATIONS'] as AdminRole[],
  suspendUser: ['SUPER_ADMIN', 'OPERATIONS'] as AdminRole[],
  banUser: ['SUPER_ADMIN', 'OPERATIONS'] as AdminRole[],
  manageEscrow: ['SUPER_ADMIN', 'FINANCE'] as AdminRole[],
  resolveDisputes: ['SUPER_ADMIN', 'OPERATIONS', 'SUPPORT'] as AdminRole[],
  exportReports: ['SUPER_ADMIN', 'FINANCE'] as AdminRole[],
  manageAdmins: ['SUPER_ADMIN'] as AdminRole[],
  platformSettings: ['SUPER_ADMIN'] as AdminRole[],
  viewAuditLogs: ['SUPER_ADMIN', 'OPERATIONS', 'FINANCE', 'MODERATOR', 'SUPPORT'] as AdminRole[],
  viewAllAuditLogs: ['SUPER_ADMIN'] as AdminRole[],
  moderateReviews: ['SUPER_ADMIN', 'OPERATIONS', 'MODERATOR'] as AdminRole[],
  viewNotifications: ['SUPER_ADMIN', 'OPERATIONS', 'FINANCE', 'MODERATOR', 'SUPPORT'] as AdminRole[],
} as const
