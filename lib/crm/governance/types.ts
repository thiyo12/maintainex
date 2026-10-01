import type { AdminRole } from '@/lib/admin-types'

export type ApprovalTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4'
export type ApprovalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_APPROVAL'
  | 'ON_HOLD'
  | 'APPROVED'
  | 'EXECUTING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'RETRY_PENDING'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'

export type ReversibilityClass = 'R0' | 'R1' | 'R2' | 'R3' | 'R4'
export type PermissionClass = 'OWNER_ONLY' | 'SENSITIVE' | 'NORMAL' | 'READ' | 'SYSTEM_ONLY'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type RiskDecision = 'ALLOW' | 'ESCALATE' | 'HOLD' | 'PROHIBIT'

export interface ActionDefinition {
  id: CrmActionId
  label: string
  permissionClass: PermissionClass
  initiatePermission: string
  approvePermission?: string
  ownerRoles: readonly AdminRole[]
  initiatorRoles: readonly AdminRole[]
  approverRoles: Partial<Record<ApprovalTier, readonly AdminRole[]>>
  requiresMarketScope: boolean
  reversibility: ReversibilityClass
  riskLevel: RiskLevel
  baseTier: ApprovalTier
  makerCheckerFromTier?: ApprovalTier
  stepUpFromTier?: ApprovalTier
  breakGlass?: 'NONE' | 'SAFER_STATE_ONLY'
}

export type CrmActionId =
  | 'jobs.cancel'
  | 'jobs.lifecycle_exception'
  | 'jobs.reassign'
  | 'customers.suspend'
  | 'taskers.suspend'
  | 'companies.suspend'
  | 'kyc.approve'
  | 'kyc.reject'
  | 'finance.refund'
  | 'finance.escrow.manual_release'
  | 'finance.wallet.adjust'
  | 'finance.wallet.freeze'
  | 'finance.payout'
  | 'finance.payout_destination.change'
  | 'finance.settlement'
  | 'finance.commission.publish'
  | 'finance.commission.enforce'
  | 'finance.commission.reconcile'
  | 'platform.market.disable'
  | 'notifications.broadcast'
  | 'staff.create'
  | 'staff.account.update'
  | 'staff.delete'
  | 'staff.role.change'
  | 'staff.permission.change'
  | 'staff.scope.change'
  | 'staff.session.revoke'
  | 'security.ip.block'
  | 'breakglass.payouts.freeze'
  | 'breakglass.market.disable'

export interface ApprovalDecisionRecord {
  adminId: string
  role: AdminRole
  decision: 'APPROVE' | 'REJECT'
  decidedAt: Date
}

export interface ApprovalEligibilityInput {
  actionId: CrmActionId
  tier: ApprovalTier
  initiatorAdminId: string
  approverAdminId: string
  approverRole: AdminRole
  priorDecisions?: readonly ApprovalDecisionRecord[]
}

export interface ApprovalEligibilityResult {
  allowed: boolean
  code?: string
  reason?: string
}

export interface RiskPolicyContext {
  actionId: CrmActionId
  market: string
  currency?: string
  amountMinor?: bigint
  remainingRefundableMinor?: bigint
  activeDispute?: boolean
  fraudOrSecurityHold?: boolean
  kycStatus?: 'APPROVED' | 'PENDING' | 'REJECTED' | 'EXPIRED' | 'UNKNOWN'
  payoutDestinationChangedAt?: Date | null
  firstPayout?: boolean
  rollingRecipientAmountMinor24h?: bigint
  rollingRecipientAmountMinor7d?: bigint
  rollingStaffAmountMinor24h?: bigint
  suspectedThresholdSplitting?: boolean
  currencyMismatch?: boolean
  countryOrRecipientMismatch?: boolean
  manualAfterRelease?: boolean
  activeChargeback?: boolean
  recentIdentityOrKycChange?: boolean
  unexpectedThirdPartyDestination?: boolean
  failedApprovalAttempts30m?: number
  gatewayResultUncertain?: boolean
  selfEscalationAttempt?: boolean
  lastActiveSuperAdminRemoval?: boolean
  requiredTotpMissing?: boolean
  jobStatus?: string
  hasFinancialImpact?: boolean
  financialAlreadyReleased?: boolean
}

export interface RiskPolicyResult {
  decision: RiskDecision
  tier: ApprovalTier
  reasons: string[]
  holdCodes: string[]
  prohibitCodes: string[]
  policyVersion: string
}
