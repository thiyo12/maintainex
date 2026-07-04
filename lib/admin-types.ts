export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'SUPPORT'

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
