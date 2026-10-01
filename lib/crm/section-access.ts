import type { AdminRole } from '@/lib/admin-types'
import { crmHasPermission } from '@/lib/crm/security'

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
  isSuperAdmin = role === 'SUPER_ADMIN'
): CrmSectionAccess {
  return {
    work: crmHasPermission(role, 'jobs:view'),
    finance:
      crmHasPermission(role, 'wallets:view') ||
      crmHasPermission(role, 'commission:view'),
    trust:
      crmHasPermission(role, 'kyc:view') ||
      crmHasPermission(role, 'disputes:view') ||
      crmHasPermission(role, 'risk_events:read') ||
      crmHasPermission(role, 'credentials:read') ||
      crmHasPermission(role, 'trust:view') ||
      crmHasPermission(role, 'security:view'),
    audit: crmHasPermission(role, 'audit:read'),
    security: crmHasPermission(role, 'security:view'),
    customerCrm:
      isSuperAdmin ||
      crmHasPermission(role, 'users:edit') ||
      crmHasPermission(role, 'support:view'),
  }
}
