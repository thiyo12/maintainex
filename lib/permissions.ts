import type { AdminRole } from './admin-types'

const ROLE_HIERARCHY: Record<AdminRole, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
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
  viewDashboard: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT'] as AdminRole[],
  viewKyc: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'] as AdminRole[],
  approveKyc: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'] as AdminRole[],
  manageJobs: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'] as AdminRole[],
  forceCancelJob: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'] as AdminRole[],
  manageCategories: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'] as AdminRole[],
  manageUsers: ['SUPER_ADMIN', 'ADMIN'] as AdminRole[],
  suspendUser: ['SUPER_ADMIN', 'ADMIN'] as AdminRole[],
  banUser: ['SUPER_ADMIN', 'ADMIN'] as AdminRole[],
  manageEscrow: ['SUPER_ADMIN', 'ADMIN'] as AdminRole[],
  resolveDisputes: ['SUPER_ADMIN', 'ADMIN'] as AdminRole[],
  exportReports: ['SUPER_ADMIN', 'ADMIN'] as AdminRole[],
  manageAdmins: ['SUPER_ADMIN'] as AdminRole[],
  platformSettings: ['SUPER_ADMIN'] as AdminRole[],
  viewAuditLogs: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT'] as AdminRole[],
  viewAllAuditLogs: ['SUPER_ADMIN'] as AdminRole[],
  moderateReviews: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'] as AdminRole[],
  viewNotifications: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT'] as AdminRole[],
} as const
