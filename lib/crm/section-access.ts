import type { AdminRole } from '@/lib/admin-types'
import {
  evaluateEffectivePermission,
  getPermissionCatalogEntry,
  type PermissionOverride,
} from '@/lib/crm/governance'

export interface CrmSectionAccess {
  work: boolean
  finance: boolean
  trust: boolean
  audit: boolean
  security: boolean
  customerCrm: boolean
}

export function getCrmSectionAccess(
  role: AdminRole,
  isSuperAdmin = role === 'SUPER_ADMIN',
  overrides: readonly PermissionOverride[] = []
): CrmSectionAccess {
  const can = (permission: string) => {
    const entry = getPermissionCatalogEntry(permission)
    return evaluateEffectivePermission({
      role,
      permission,
      permissionClass: entry?.class,
      overrides,
    }).allowed
  }

  return {
    work: can('jobs:view'),
    finance:
      can('wallets:view') ||
      can('commission:view') ||
      can('finance:payments:view'),
    trust:
      can('kyc:view') ||
      can('kyc:review') ||
      can('disputes:view') ||
      can('risk_events:read') ||
      can('risk:view') ||
      can('credentials:read') ||
      can('credentials:view') ||
      can('trust:view') ||
      can('security:view'),
    audit: can('audit:read') || can('audit:view'),
    security: can('security:view'),
    customerCrm:
      isSuperAdmin ||
      can('users:edit') ||
      can('customers:edit') ||
      can('support:view'),
  }
}
