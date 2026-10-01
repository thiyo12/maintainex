import type { ActionDefinition, ApprovalEligibilityInput, ApprovalEligibilityResult, ApprovalTier, CrmActionId } from './types'

const TIER_ORDER: Record<ApprovalTier, number> = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 }

export const CRM_ACTIONS: Readonly<Record<CrmActionId, ActionDefinition>> = {
  'jobs.cancel': {
    id: 'jobs.cancel',
    label: 'Cancel job',
    permissionClass: 'SENSITIVE',
    initiatePermission: 'jobs:cancel',
    approvePermission: 'jobs:exception:approve',
    ownerRoles: ['MANAGER', 'SUPER_ADMIN'],
    initiatorRoles: ['MANAGER', 'SUPPORT', 'SUPER_ADMIN'],
    approverRoles: { T1: ['MANAGER', 'SUPER_ADMIN'], T2: ['MANAGER', 'SUPER_ADMIN'], T3: ['SUPER_ADMIN'], T4: ['SUPER_ADMIN'] },
    requiresMarketScope: true,
    reversibility: 'R2',
    riskLevel: 'HIGH',
    baseTier: 'T1',
    makerCheckerFromTier: 'T2',
    stepUpFromTier: 'T2',
    breakGlass: 'NONE',
  },
  'jobs.lifecycle_exception': {
    id: 'jobs.lifecycle_exception',
    label: 'Approve job lifecycle exception',
    permissionClass: 'SENSITIVE',
    initiatePermission: 'jobs:exception:request',
    approvePermission: 'jobs:exception:approve',
    ownerRoles: ['MANAGER', 'SUPER_ADMIN'],
    initiatorRoles: ['MANAGER', 'SUPPORT', 'SUPER_ADMIN'],
    approverRoles: { T2: ['MANAGER', 'SUPER_ADMIN'], T3: ['SUPER_ADMIN'], T4: ['SUPER_ADMIN'] },
    requiresMarketScope: true,
    reversibility: 'R3',
    riskLevel: 'CRITICAL',
    baseTier: 'T2',
    makerCheckerFromTier: 'T2',
    stepUpFromTier: 'T2',
    breakGlass: 'NONE',
  },
  'jobs.reassign': {
    id: 'jobs.reassign',
    label: 'Reassign provider/company',
    permissionClass: 'SENSITIVE',
    initiatePermission: 'jobs:assign',
    ownerRoles: ['MANAGER', 'SUPER_ADMIN'],
    initiatorRoles: ['MANAGER', 'SUPER_ADMIN'],
    approverRoles: { T1: ['MANAGER', 'SUPER_ADMIN'], T2: ['MANAGER', 'SUPER_ADMIN'] },
    requiresMarketScope: true,
    reversibility: 'R2',
    riskLevel: 'HIGH',
    baseTier: 'T1',
    breakGlass: 'NONE',
  },
  'customers.suspend': {
    id: 'customers.suspend',
    label: 'Suspend customer',
    permissionClass: 'SENSITIVE',
    initiatePermission: 'customers:status:manage',
    ownerRoles: ['USER_MANAGEMENT', 'SUPER_ADMIN'],
    initiatorRoles: ['USER_MANAGEMENT', 'MANAGER', 'TECHNICAL', 'SUPER_ADMIN'],
    approverRoles: { T1: ['USER_MANAGEMENT', 'MANAGER', 'SUPER_ADMIN'] },
    requiresMarketScope: true,
    reversibility: 'R2',
    riskLevel: 'HIGH',
    baseTier: 'T1',
    breakGlass: 'SAFER_STATE_ONLY',
  },
  'taskers.suspend': {
    id: 'taskers.suspend',
    label: 'Suspend tasker',
    permissionClass: 'SENSITIVE',
    initiatePermission: 'taskers:status:manage',
    ownerRoles: ['USER_MANAGEMENT', 'SUPER_ADMIN'],
    initiatorRoles: ['USER_MANAGEMENT', 'MANAGER', 'TECHNICAL', 'SUPER_ADMIN'],
    approverRoles: { T1: ['USER_MANAGEMENT', 'MANAGER', 'SUPER_ADMIN'] },
    requiresMarketScope: true,
    reversibility: 'R2',
    riskLevel: 'HIGH',
    baseTier: 'T1',
    breakGlass: 'SAFER_STATE_ONLY',
  },
  'companies.suspend': {
    id: 'companies.suspend',
    label: 'Suspend company',
    permissionClass: 'SENSITIVE',
    initiatePermission: 'companies:status:manage',
    ownerRoles: ['USER_MANAGEMENT', 'SUPER_ADMIN'],
    initiatorRoles: ['USER_MANAGEMENT', 'MANAGER', 'TECHNICAL', 'SUPER_ADMIN'],
    approverRoles: { T1: ['USER_MANAGEMENT', 'MANAGER', 'SUPER_ADMIN'] },
    requiresMarketScope: true,
    reversibility: 'R2',
    riskLevel: 'HIGH',
    baseTier: 'T1',
    breakGlass: 'SAFER_STATE_ONLY',
  },
  'kyc.approve': {
    id: 'kyc.approve',
    label: 'Approve KYC',
    permissionClass: 'SENSITIVE',
    initiatePermission: 'kyc:approve',
    ownerRoles: ['USER_MANAGEMENT', 'SUPER_ADMIN'],
    initiatorRoles: ['USER_MANAGEMENT', 'SUPER_ADMIN'],
    approverRoles: { T1: ['USER_MANAGEMENT', 'MANAGER', 'SUPER_ADMIN'], T2: ['MANAGER', 'SUPER_ADMIN'] },
    requiresMarketScope: true,
    reversibility: 'R2',
    riskLevel: 'HIGH',
    baseTier: 'T1',
    breakGlass: 'NONE',
  },
  'kyc.reject': {
    id: 'kyc.reject',
    label: 'Reject KYC',
    permissionClass: 'SENSITIVE',
    initiatePermission: 'kyc:reject',
    ownerRoles: ['USER_MANAGEMENT', 'SUPER_ADMIN'],
    initiatorRoles: ['USER_MANAGEMENT', 'SUPER_ADMIN'],
    approverRoles: { T1: ['USER_MANAGEMENT', 'MANAGER', 'SUPER_ADMIN'] },
    requiresMarketScope: true,
    reversibility: 'R2',
    riskLevel: 'HIGH',
    baseTier: 'T1',
    breakGlass: 'NONE',
  },
  'finance.refund': {
    id: 'finance.refund',
    label: 'Refund payment',
    permissionClass: 'SENSITIVE',
    initiatePermission: 'finance:refund:initiate',
    approvePermission: 'finance:refund:approve',
    ownerRoles: ['FINANCE', 'SUPER_ADMIN'],
    initiatorRoles: ['FINANCE', 'SUPER_ADMIN'],
    approverRoles: { T1: ['FINANCE', 'SUPER_ADMIN'], T2: ['FINANCE', 'MANAGER', 'SUPER_ADMIN'], T3: ['MANAGER', 'SUPER_ADMIN'], T4: ['SUPER_ADMIN'] },
    requiresMarketScope: true,
    reversibility: 'R3',
    riskLevel: 'CRITICAL',
    baseTier: 'T1',
    makerCheckerFromTier: 'T2',
    stepUpFromTier: 'T1',
    breakGlass: 'NONE',
  },
  'finance.escrow.manual_release': {
    id: 'finance.escrow.manual_release',
    label: 'Manually release escrow',
    permissionClass: 'SENSITIVE',
    initiatePermission: 'finance:escrow:release:initiate',
    approvePermission: 'finance:escrow:release:approve',
    ownerRoles: ['FINANCE', 'SUPER_ADMIN'],
    initiatorRoles: ['FINANCE', 'SUPER_ADMIN'],
    approverRoles: { T2: ['FINANCE', 'MANAGER', 'SUPER_ADMIN'], T3: ['MANAGER', 'SUPER_ADMIN'], T4: ['SUPER_ADMIN'] },
    requiresMarketScope: true,
    reversibility: 'R3',
    riskLevel: 'CRITICAL',
    baseTier: 'T2',
    makerCheckerFromTier: 'T2',
    stepUpFromTier: 'T2',
    breakGlass: 'NONE',
  },
  'finance.wallet.adjust': {
    id: 'finance.wallet.adjust',
    label: 'Create wallet correction entry',
    permissionClass: 'SENSITIVE',
    initiatePermission: 'finance:wallets:adjust:initiate',
    approvePermission: 'finance:wallets:adjust:approve',
    ownerRoles: ['FINANCE', 'SUPER_ADMIN'],
    initiatorRoles: ['FINANCE', 'SUPER_ADMIN'],
    approverRoles: { T1: ['FINANCE', 'SUPER_ADMIN'], T2: ['FINANCE', 'MANAGER', 'SUPER_ADMIN'], T3: ['MANAGER', 'SUPER_ADMIN'], T4: ['SUPER_ADMIN'] },
    requiresMarketScope: true,
    reversibility: 'R3',
    riskLevel: 'CRITICAL',
    baseTier: 'T1',
    makerCheckerFromTier: 'T2',
    stepUpFromTier: 'T1',
    breakGlass: 'NONE',
  },
  'finance.payout': {
    id: 'finance.payout',
    label: 'Process payout',
    permissionClass: 'SENSITIVE',
    initiatePermission: 'finance:payouts:initiate',
    approvePermission: 'finance:payouts:approve',
    ownerRoles: ['FINANCE', 'SUPER_ADMIN'],
    initiatorRoles: ['FINANCE', 'SUPER_ADMIN'],
    approverRoles: { T1: ['FINANCE', 'SUPER_ADMIN'], T2: ['FINANCE', 'MANAGER', 'SUPER_ADMIN'], T3: ['MANAGER', 'SUPER_ADMIN'], T4: ['SUPER_ADMIN'] },
    requiresMarketScope: true,
    reversibility: 'R4',
    riskLevel: 'CRITICAL',
    baseTier: 'T1',
    makerCheckerFromTier: 'T2',
    stepUpFromTier: 'T1',
    breakGlass: 'NONE',
  },
  'finance.payout_destination.change': {
    id: 'finance.payout_destination.change',
    label: 'Change payout destination',
    permissionClass: 'SENSITIVE',
    initiatePermission: 'finance:payout-destination:manage',
    approvePermission: 'finance:payout-destination:approve',
    ownerRoles: ['FINANCE', 'SUPER_ADMIN'],
    initiatorRoles: ['FINANCE', 'SUPER_ADMIN'],
    approverRoles: { T3: ['MANAGER', 'SUPER_ADMIN'], T4: ['SUPER_ADMIN'] },
    requiresMarketScope: true,
    reversibility: 'R2',
    riskLevel: 'CRITICAL',
    baseTier: 'T3',
    makerCheckerFromTier: 'T3',
    stepUpFromTier: 'T3',
    breakGlass: 'NONE',
  },
  'finance.settlement': {
    id: 'finance.settlement',
    label: 'Process settlement',
    permissionClass: 'SENSITIVE',
    initiatePermission: 'finance:settlements:initiate',
    approvePermission: 'finance:settlements:approve',
    ownerRoles: ['FINANCE', 'SUPER_ADMIN'],
    initiatorRoles: ['FINANCE', 'SUPER_ADMIN'],
    approverRoles: { T1: ['FINANCE', 'SUPER_ADMIN'], T2: ['FINANCE', 'MANAGER', 'SUPER_ADMIN'], T3: ['MANAGER', 'SUPER_ADMIN'], T4: ['SUPER_ADMIN'] },
    requiresMarketScope: true,
    reversibility: 'R3',
    riskLevel: 'CRITICAL',
    baseTier: 'T1',
    makerCheckerFromTier: 'T2',
    stepUpFromTier: 'T1',
    breakGlass: 'NONE',
  },
  'finance.commission.publish': {
    id: 'finance.commission.publish',
    label: 'Publish future commission policy',
    permissionClass: 'OWNER_ONLY',
    initiatePermission: 'finance:commission:publish',
    ownerRoles: ['SUPER_ADMIN'],
    initiatorRoles: ['SUPER_ADMIN'],
    approverRoles: { T3: ['SUPER_ADMIN'], T4: ['SUPER_ADMIN'] },
    requiresMarketScope: false,
    reversibility: 'R2',
    riskLevel: 'CRITICAL',
    baseTier: 'T3',
    stepUpFromTier: 'T3',
    breakGlass: 'NONE',
  },
  'platform.market.disable': {
    id: 'platform.market.disable',
    label: 'Disable market/channel',
    permissionClass: 'OWNER_ONLY',
    initiatePermission: 'markets:publish',
    ownerRoles: ['SUPER_ADMIN'],
    initiatorRoles: ['SUPER_ADMIN'],
    approverRoles: { T3: ['SUPER_ADMIN'], T4: ['SUPER_ADMIN'] },
    requiresMarketScope: false,
    reversibility: 'R2',
    riskLevel: 'CRITICAL',
    baseTier: 'T3',
    stepUpFromTier: 'T3',
    breakGlass: 'SAFER_STATE_ONLY',
  },
  'notifications.broadcast': {
    id: 'notifications.broadcast',
    label: 'Send broadcast notification',
    permissionClass: 'SENSITIVE',
    initiatePermission: 'notifications:broadcast:create',
    approvePermission: 'notifications:broadcast:approve',
    ownerRoles: ['MANAGER', 'SUPER_ADMIN'],
    initiatorRoles: ['MANAGER', 'SUPPORT', 'FINANCE', 'USER_MANAGEMENT', 'TECHNICAL', 'SUPER_ADMIN'],
    approverRoles: { T2: ['MANAGER', 'SUPER_ADMIN'], T3: ['MANAGER', 'SUPER_ADMIN'], T4: ['SUPER_ADMIN'] },
    requiresMarketScope: true,
    reversibility: 'R4',
    riskLevel: 'CRITICAL',
    baseTier: 'T2',
    makerCheckerFromTier: 'T2',
    stepUpFromTier: 'T2',
    breakGlass: 'NONE',
  },
  'staff.role.change': {
    id: 'staff.role.change',
    label: 'Change staff role',
    permissionClass: 'OWNER_ONLY',
    initiatePermission: 'staff:role:manage',
    ownerRoles: ['SUPER_ADMIN'],
    initiatorRoles: ['SUPER_ADMIN'],
    approverRoles: { T3: ['SUPER_ADMIN'] },
    requiresMarketScope: false,
    reversibility: 'R2',
    riskLevel: 'CRITICAL',
    baseTier: 'T3',
    stepUpFromTier: 'T3',
    breakGlass: 'NONE',
  },
  'staff.permission.change': {
    id: 'staff.permission.change',
    label: 'Change staff permissions',
    permissionClass: 'OWNER_ONLY',
    initiatePermission: 'staff:permissions:manage',
    ownerRoles: ['SUPER_ADMIN'],
    initiatorRoles: ['SUPER_ADMIN'],
    approverRoles: { T3: ['SUPER_ADMIN'] },
    requiresMarketScope: false,
    reversibility: 'R2',
    riskLevel: 'CRITICAL',
    baseTier: 'T3',
    stepUpFromTier: 'T3',
    breakGlass: 'NONE',
  },
  'staff.scope.change': {
    id: 'staff.scope.change',
    label: 'Change staff market scope',
    permissionClass: 'OWNER_ONLY',
    initiatePermission: 'staff:scope:manage',
    ownerRoles: ['SUPER_ADMIN'],
    initiatorRoles: ['SUPER_ADMIN'],
    approverRoles: { T3: ['SUPER_ADMIN'] },
    requiresMarketScope: false,
    reversibility: 'R2',
    riskLevel: 'CRITICAL',
    baseTier: 'T3',
    stepUpFromTier: 'T3',
    breakGlass: 'NONE',
  },
  'staff.session.revoke': {
    id: 'staff.session.revoke',
    label: 'Revoke staff session',
    permissionClass: 'SENSITIVE',
    initiatePermission: 'staff:sessions:revoke',
    ownerRoles: ['TECHNICAL', 'SUPER_ADMIN'],
    initiatorRoles: ['TECHNICAL', 'MANAGER', 'SUPER_ADMIN'],
    approverRoles: { T1: ['TECHNICAL', 'SUPER_ADMIN'] },
    requiresMarketScope: false,
    reversibility: 'R2',
    riskLevel: 'HIGH',
    baseTier: 'T1',
    breakGlass: 'SAFER_STATE_ONLY',
  },
  'security.ip.block': {
    id: 'security.ip.block',
    label: 'Block IP address',
    permissionClass: 'SENSITIVE',
    initiatePermission: 'security:ip-block:manage',
    ownerRoles: ['TECHNICAL', 'SUPER_ADMIN'],
    initiatorRoles: ['TECHNICAL', 'SUPER_ADMIN'],
    approverRoles: { T1: ['TECHNICAL', 'SUPER_ADMIN'] },
    requiresMarketScope: false,
    reversibility: 'R1',
    riskLevel: 'HIGH',
    baseTier: 'T1',
    breakGlass: 'SAFER_STATE_ONLY',
  },
  'breakglass.payouts.freeze': {
    id: 'breakglass.payouts.freeze',
    label: 'Emergency freeze payouts',
    permissionClass: 'OWNER_ONLY',
    initiatePermission: 'security:breakglass',
    ownerRoles: ['SUPER_ADMIN'],
    initiatorRoles: ['SUPER_ADMIN'],
    approverRoles: { T4: ['SUPER_ADMIN'] },
    requiresMarketScope: false,
    reversibility: 'R2',
    riskLevel: 'CRITICAL',
    baseTier: 'T4',
    stepUpFromTier: 'T4',
    breakGlass: 'SAFER_STATE_ONLY',
  },
  'breakglass.market.disable': {
    id: 'breakglass.market.disable',
    label: 'Emergency disable market',
    permissionClass: 'OWNER_ONLY',
    initiatePermission: 'security:breakglass',
    ownerRoles: ['SUPER_ADMIN'],
    initiatorRoles: ['SUPER_ADMIN'],
    approverRoles: { T4: ['SUPER_ADMIN'] },
    requiresMarketScope: false,
    reversibility: 'R2',
    riskLevel: 'CRITICAL',
    baseTier: 'T4',
    stepUpFromTier: 'T4',
    breakGlass: 'SAFER_STATE_ONLY',
  },
}

export function getCrmAction(id: CrmActionId): ActionDefinition {
  return CRM_ACTIONS[id]
}

export function tierAtLeast(actual: ApprovalTier, minimum: ApprovalTier): boolean {
  return TIER_ORDER[actual] >= TIER_ORDER[minimum]
}

export function evaluateApprovalEligibility(input: ApprovalEligibilityInput): ApprovalEligibilityResult {
  const action = getCrmAction(input.actionId)
  const allowedRoles = action.approverRoles[input.tier] || []

  if (!allowedRoles.includes(input.approverRole)) {
    return { allowed: false, code: 'APPROVER_ROLE_FORBIDDEN', reason: 'Approver role is not allowed for this tier.' }
  }

  if (
    action.makerCheckerFromTier &&
    tierAtLeast(input.tier, action.makerCheckerFromTier) &&
    input.initiatorAdminId === input.approverAdminId
  ) {
    return { allowed: false, code: 'SELF_APPROVAL_FORBIDDEN', reason: 'Initiator cannot approve this action.' }
  }

  if (input.priorDecisions?.some(decision => decision.adminId === input.approverAdminId)) {
    return { allowed: false, code: 'DUPLICATE_APPROVER', reason: 'This staff account has already decided this request.' }
  }

  return { allowed: true }
}


export type ApprovalSlot = readonly import('@/lib/admin-types').AdminRole[]

export function getApprovalSlots(actionId: CrmActionId, tier: ApprovalTier): readonly ApprovalSlot[] {
  if (tier === 'T0') return []

  const action = getCrmAction(actionId)
  const fallback = action.approverRoles[tier] || []

  switch (actionId) {
    case 'finance.refund':
    case 'finance.escrow.manual_release':
    case 'finance.wallet.adjust':
    case 'finance.payout':
    case 'finance.settlement': {
      if (tier === 'T1') return [['FINANCE', 'SUPER_ADMIN']]
      if (tier === 'T2') return [['FINANCE', 'MANAGER', 'SUPER_ADMIN']]
      if (tier === 'T3' || tier === 'T4') {
        return [
          ['MANAGER', 'SUPER_ADMIN'],
          ['SUPER_ADMIN'],
        ]
      }
      break
    }

    case 'finance.payout_destination.change':
      if (tier === 'T3' || tier === 'T4') {
        return [
          ['MANAGER', 'SUPER_ADMIN'],
          ['SUPER_ADMIN'],
        ]
      }
      break

    case 'notifications.broadcast':
      if (tier === 'T4') {
        return [
          ['MANAGER', 'SUPER_ADMIN'],
          ['SUPER_ADMIN'],
        ]
      }
      if (tier === 'T2' || tier === 'T3') {
        return [['MANAGER', 'SUPER_ADMIN']]
      }
      break
  }

  return fallback.length ? [fallback] : []
}
