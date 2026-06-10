export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'SUPPORT'

export type AuditAction =
  | 'LOGIN' | 'LOGOUT'
  | 'CREATE' | 'UPDATE' | 'DELETE'
  | 'SUSPEND' | 'UNSUSPEND' | 'BAN' | 'UNBAN'
  | 'KYC_APPROVE' | 'KYC_REJECT'
  | 'JOB_CANCEL' | 'ESCROW_RELEASE' | 'ESCROW_REFUND'
  | 'ADMIN_CREATE' | 'ADMIN_UPDATE' | 'SETTINGS_UPDATE'

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
