export type AdminRole = 'SUPER_ADMIN' | 'MANAGER' | 'FINANCE' | 'USER_MANAGEMENT' | 'SUPPORT' | 'TECHNICAL'

export const ADMIN_ROLES: Record<AdminRole, { label: string; color: string; description: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'purple', description: 'Full platform access, can reassign work queue' },
  MANAGER: { label: 'Manager', color: 'blue', description: 'Full read, reassign work, resolve escalations, manage work queue' },
  FINANCE: { label: 'Finance', color: 'green', description: 'Commission, wallets & settlements — settlement queue' },
  USER_MANAGEMENT: { label: 'User Management', color: 'orange', description: 'KYC review, user suspension & ban — KYC queue' },
  SUPPORT: { label: 'Support', color: 'yellow', description: 'Disputes, complaints & user tickets — dispute queue' },
  TECHNICAL: { label: 'Technical', color: 'cyan', description: 'Security audit, system health & error logs — system queue' },
}

export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  SUPER_ADMIN: [
    'dashboard:view',
    'users:view', 'users:edit', 'users:ban', 'users:suspend',
    'taskers:view', 'taskers:edit', 'taskers:ban', 'taskers:verify',
    'companies:view', 'companies:edit', 'companies:ban', 'companies:verify',
    'kyc:view', 'kyc:approve', 'kyc:reject',
    'jobs:view', 'jobs:manage', 'jobs:cancel',
    'commission:view', 'commission:manage', 'commission:config',
    'wallets:view', 'wallets:manage',
    'disputes:view', 'disputes:resolve',
    'cheating:view', 'cheating:action',
    'support:view', 'support:respond',
    'queue:view', 'queue:manage', 'queue:assign',
    'analytics:view',
    'admins:view', 'admins:create', 'admins:edit', 'admins:delete',
    'settings:view', 'settings:edit',
    'security:view', 'security:audit',
    'wishlist:view', 'wishlist:manage',
  ],
  MANAGER: [
    'dashboard:view',
    'users:view', 'users:edit',
    'taskers:view', 'taskers:edit', 'taskers:verify',
    'companies:view', 'companies:edit', 'companies:verify',
    'jobs:view', 'jobs:manage',
    'disputes:view', 'disputes:resolve',
    'cheating:view', 'cheating:action',
    'queue:view', 'queue:manage', 'queue:assign',
    'analytics:view',
    'wishlist:view', 'wishlist:manage',
  ],
  FINANCE: [
    'dashboard:view',
    'users:view',
    'taskers:view',
    'companies:view',
    'commission:view', 'commission:manage', 'commission:config',
    'wallets:view', 'wallets:manage',
    'queue:view',
    'analytics:view',
  ],
  USER_MANAGEMENT: [
    'dashboard:view',
    'users:view', 'users:edit', 'users:ban', 'users:suspend',
    'taskers:view', 'taskers:edit', 'taskers:ban', 'taskers:verify',
    'companies:view', 'companies:edit', 'companies:ban', 'companies:verify',
    'kyc:view', 'kyc:approve', 'kyc:reject',
    'cheating:view', 'cheating:action',
    'queue:view',
  ],
  SUPPORT: [
    'dashboard:view',
    'users:view',
    'taskers:view',
    'companies:view',
    'disputes:view', 'disputes:resolve',
    'cheating:view',
    'support:view', 'support:respond',
    'kyc:view',
    'queue:view',
  ],
  TECHNICAL: [
    'dashboard:view',
    'security:view', 'security:audit',
    'queue:view',
    'analytics:view',
  ],
}

export type AuditAction =
  | 'LOGIN' | 'LOGOUT'
  | 'CREATE' | 'UPDATE' | 'DELETE'
  | 'SUSPEND' | 'UNSUSPEND' | 'BAN' | 'UNBAN'
  | 'KYC_APPROVE' | 'KYC_REJECT'
  | 'JOB_CANCEL' | 'ESCROW_RELEASE' | 'ESCROW_REFUND'
  | 'ADMIN_CREATE' | 'ADMIN_UPDATE' | 'SETTINGS_UPDATE'
  | '2FA_ENABLE' | '2FA_DISABLE' | '2FA_VERIFY'
  | 'FLAG_DISMISS' | 'FLAG_WARN' | 'FLAG_FREEZE'
  | 'OFFER_CREATE' | 'OFFER_UPDATE' | 'OFFER_DELETE'
  | 'ALERT_ASSIGN' | 'ALERT_RESOLVE' | 'ALERT_DISMISS'
  | 'NOTIFICATION_BROADCAST'
  | 'REVIEW_APPROVE' | 'REVIEW_REJECT' | 'REVIEW_FLAG'
  | 'PROPERTY_APPROVE' | 'PROPERTY_REJECT' | 'PROPERTY_FEATURE'
  | 'COMMISSION_CONFIG' | 'WALLET_FREEZE' | 'WALLET_UNFREEZE'
  | 'SETTLEMENT_PROCESS' | 'SETTLEMENT_OVERDUE'
  | 'COMMISSION_PAYMENT_CONFIRM'
  | 'PAYOUT_PROCESS' | 'PAYOUT_REJECT'
  | 'JOB_FLAG'

export interface AdminSession {
  id: string
  email: string
  role: AdminRole
  firstName: string
  lastName: string
  assignedCountries: string[]
  authType: 'adminUser'
}

export interface AuditLogPayload {
  adminUserId: string
  adminEmail: string
  adminRole: string
  action: string
  targetTable?: string
  targetId?: string
  targetLabel?: string
  oldValue?: any
  newValue?: any
  ipAddress: string
  userAgent?: string | null
}
