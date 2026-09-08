export type CompanyRole = 'COMPANY_OWNER' | 'MANAGER' | 'DISPATCHER' | 'WORKER' | 'FINANCE'

export const COMPANY_ROLES: Record<CompanyRole, { label: string; description: string }> = {
  COMPANY_OWNER: { label: 'Owner', description: 'Full company control including ownership transfer and deletion' },
  MANAGER: { label: 'Manager', description: 'Manage workers, jobs, services, and company settings' },
  DISPATCHER: { label: 'Dispatcher', description: 'View incoming work, assign workers, manage schedules' },
  WORKER: { label: 'Worker', description: 'View assigned work, update execution status' },
  FINANCE: { label: 'Finance', description: 'View company financial information and payout/settlement records' },
}

const ROLE_HIERARCHY: Record<CompanyRole, number> = {
  COMPANY_OWNER: 50,
  MANAGER: 40,
  DISPATCHER: 30,
  FINANCE: 25,
  WORKER: 10,
}

export const COMPANY_PERMISSIONS: Record<CompanyRole, string[]> = {
  COMPANY_OWNER: [
    'company:read', 'company:update', 'company:delete', 'company:transfer_ownership',
    'members:read', 'members:invite', 'members:remove', 'members:change_role',
    'workers:read', 'workers:assign', 'workers:manage',
    'jobs:read', 'jobs:manage', 'jobs:assign',
    'quotes:read', 'quotes:submit', 'quotes:manage',
    'finance:read', 'finance:payout',
    'certifications:read', 'certifications:manage',
    'documents:read', 'documents:upload', 'documents:manage',
    'verification:read', 'verification:submit',
    'audit:read',
  ],
  MANAGER: [
    'company:read', 'company:update',
    'members:read', 'members:invite',
    'workers:read', 'workers:assign', 'workers:manage',
    'jobs:read', 'jobs:manage', 'jobs:assign',
    'quotes:read', 'quotes:submit', 'quotes:manage',
    'finance:read',
    'certifications:read',
    'documents:read', 'documents:upload',
    'verification:read',
  ],
  DISPATCHER: [
    'company:read',
    'members:read',
    'workers:read', 'workers:assign',
    'jobs:read', 'jobs:assign',
    'quotes:read',
  ],
  WORKER: [
    'company:read',
    'jobs:read',
    'quotes:read',
  ],
  FINANCE: [
    'company:read',
    'finance:read',
    'members:read',
    'jobs:read',
    'audit:read',
  ],
}

export function isValidCompanyRole(role: string): role is CompanyRole {
  return role in COMPANY_ROLES
}

export function getRoleHierarchyLevel(role: CompanyRole): number {
  return ROLE_HIERARCHY[role] ?? 0
}

export function canAssignRole(actorRole: CompanyRole, targetRole: CompanyRole): boolean {
  if (targetRole === 'COMPANY_OWNER') return false
  if (!['COMPANY_OWNER', 'MANAGER'].includes(actorRole)) return false
  return getRoleHierarchyLevel(actorRole) > getRoleHierarchyLevel(targetRole)
}

export function hasCompanyPermission(role: CompanyRole, permission: string): boolean {
  return COMPANY_PERMISSIONS[role]?.includes(permission) ?? false
}

export function canManageMember(actorRole: CompanyRole, targetRole: CompanyRole): boolean {
  if (!['COMPANY_OWNER', 'MANAGER'].includes(actorRole)) return false
  if (actorRole === 'COMPANY_OWNER') return true
  return getRoleHierarchyLevel(actorRole) > getRoleHierarchyLevel(targetRole)
}

export function canRemoveMember(actorRole: CompanyRole, targetRole: CompanyRole, isLastOwner: boolean): boolean {
  if (isLastOwner) return false
  if (actorRole === 'COMPANY_OWNER') return true
  return getRoleHierarchyLevel(actorRole) > getRoleHierarchyLevel(targetRole)
}

export function canAssignWorker(actorRole: CompanyRole): boolean {
  return ['COMPANY_OWNER', 'MANAGER', 'DISPATCHER'].includes(actorRole)
}

export function canSubmitQuote(actorRole: CompanyRole): boolean {
  return ['COMPANY_OWNER', 'MANAGER', 'DISPATCHER'].includes(actorRole)
}

export function canViewFinance(actorRole: CompanyRole): boolean {
  return ['COMPANY_OWNER', 'FINANCE'].includes(actorRole)
}
