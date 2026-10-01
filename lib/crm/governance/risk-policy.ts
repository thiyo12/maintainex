import { getCrmAction, tierAtLeast } from './action-registry'
import type { ApprovalTier, RiskPolicyContext, RiskPolicyResult } from './types'

export const CRM_RISK_POLICY_VERSION = 'crm-v2-risk-2026-10-01-v1'

const TIER_ORDER: Record<ApprovalTier, number> = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 }
const TIERS: ApprovalTier[] = ['T0', 'T1', 'T2', 'T3', 'T4']

export interface AmountThresholds {
  t1MaxMinor: bigint
  t2MaxMinor: bigint
  t3MaxMinor: bigint
}

export interface MarketFinancePolicy {
  market: string
  currency: string
  minorUnitFactor: bigint
  refund: AmountThresholds
  walletAdjustment: AmountThresholds
  payout: AmountThresholds
  settlement: AmountThresholds
  payoutDestinationCoolingHours: number
  firstPayoutT3ThresholdMinor: bigint
}

const lkr = (major: number): bigint => BigInt(major) * 100n

export const DEFAULT_MARKET_FINANCE_POLICIES: Readonly<Record<string, MarketFinancePolicy>> = {
  LK: {
    market: 'LK',
    currency: 'LKR',
    minorUnitFactor: 100n,
    refund: { t1MaxMinor: lkr(25_000), t2MaxMinor: lkr(100_000), t3MaxMinor: lkr(500_000) },
    walletAdjustment: { t1MaxMinor: lkr(10_000), t2MaxMinor: lkr(50_000), t3MaxMinor: lkr(250_000) },
    payout: { t1MaxMinor: lkr(100_000), t2MaxMinor: lkr(500_000), t3MaxMinor: lkr(1_000_000) },
    settlement: { t1MaxMinor: lkr(250_000), t2MaxMinor: lkr(1_000_000), t3MaxMinor: lkr(5_000_000) },
    payoutDestinationCoolingHours: 72,
    firstPayoutT3ThresholdMinor: lkr(100_000),
  },
}

function maxTier(a: ApprovalTier, b: ApprovalTier): ApprovalTier {
  return TIER_ORDER[a] >= TIER_ORDER[b] ? a : b
}

function tierFromAmount(amount: bigint | undefined, thresholds: AmountThresholds, fallback: ApprovalTier): ApprovalTier {
  if (amount === undefined) return fallback
  if (amount <= thresholds.t1MaxMinor) return 'T1'
  if (amount <= thresholds.t2MaxMinor) return 'T2'
  if (amount <= thresholds.t3MaxMinor) return 'T3'
  return 'T4'
}

function hoursSince(date: Date, now: Date): number {
  return Math.max(0, (now.getTime() - date.getTime()) / 3_600_000)
}

export function evaluateCrmRiskPolicy(
  context: RiskPolicyContext,
  now = new Date()
): RiskPolicyResult {
  const action = getCrmAction(context.actionId)
  const policy = DEFAULT_MARKET_FINANCE_POLICIES[context.market.toUpperCase()]
  let tier = action.baseTier
  const reasons: string[] = []
  const holdCodes: string[] = []
  const prohibitCodes: string[] = []

  if (context.selfEscalationAttempt) prohibitCodes.push('SELF_ESCALATION')
  if (context.lastActiveSuperAdminRemoval) prohibitCodes.push('LAST_SUPER_ADMIN')
  if (context.requiredTotpMissing && action.permissionClass === 'OWNER_ONLY') {
    holdCodes.push('PRIVILEGED_TOTP_REQUIRED')
  }

  if (context.currencyMismatch) holdCodes.push('CURRENCY_MISMATCH')
  if (context.countryOrRecipientMismatch) holdCodes.push('COUNTRY_OR_RECIPIENT_MISMATCH')
  if (context.fraudOrSecurityHold) holdCodes.push('FRAUD_OR_SECURITY_HOLD')
  if ((context.failedApprovalAttempts30m || 0) > 3) holdCodes.push('APPROVAL_ABUSE')
  if (context.gatewayResultUncertain) holdCodes.push('GATEWAY_RESULT_UNCERTAIN')

  switch (context.actionId) {
    case 'jobs.cancel': {
      const status = String(context.jobStatus || '').toUpperCase()

      if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'IN_PROGRESS') {
        prohibitCodes.push('JOB_CANCELLATION_STATE_FORBIDDEN')
        break
      }

      if (context.activeDispute) {
        holdCodes.push('ACTIVE_DISPUTE')
        break
      }

      if (context.hasFinancialImpact) {
        tier = maxTier(tier, 'T2')
        reasons.push('Cancellation has financial impact and requires maker-checker approval.')
      } else if (status === 'QUOTE_ACCEPTED') {
        tier = maxTier(tier, 'T1')
        reasons.push('Accepted-provider cancellation requires operational approval.')
      } else {
        tier = 'T0'
      }
      break
    }

    case 'finance.refund': {
      if (!policy) {
        holdCodes.push('MARKET_FINANCE_POLICY_MISSING')
        break
      }
      tier = maxTier(tier, tierFromAmount(context.amountMinor, policy.refund, 'T1'))
      if (
        context.amountMinor !== undefined &&
        context.remainingRefundableMinor !== undefined &&
        context.amountMinor > context.remainingRefundableMinor
      ) {
        prohibitCodes.push('REFUND_EXCEEDS_REMAINING')
      }
      if (context.manualAfterRelease) {
        tier = maxTier(tier, 'T3')
        reasons.push('Manual refund after release requires T3 minimum.')
      }
      if (context.activeChargeback) holdCodes.push('ACTIVE_CHARGEBACK')
      break
    }

    case 'finance.escrow.manual_release': {
      if (!policy) {
        holdCodes.push('MARKET_FINANCE_POLICY_MISSING')
        break
      }
      tier = maxTier('T2', tierFromAmount(context.amountMinor, policy.refund, 'T2'))
      if (context.activeDispute) holdCodes.push('ACTIVE_DISPUTE')
      break
    }

    case 'finance.wallet.adjust': {
      if (!policy) {
        holdCodes.push('MARKET_FINANCE_POLICY_MISSING')
        break
      }
      tier = maxTier(tier, tierFromAmount(context.amountMinor, policy.walletAdjustment, 'T1'))
      break
    }

    case 'finance.payout': {
      if (!policy) {
        holdCodes.push('MARKET_FINANCE_POLICY_MISSING')
        break
      }
      tier = maxTier(tier, tierFromAmount(context.amountMinor, policy.payout, 'T1'))
      if (context.kycStatus && context.kycStatus !== 'APPROVED') holdCodes.push('PAYOUT_KYC_NOT_APPROVED')
      if (context.payoutDestinationChangedAt) {
        const ageHours = hoursSince(context.payoutDestinationChangedAt, now)
        if (ageHours < policy.payoutDestinationCoolingHours) {
          tier = 'T4'
          holdCodes.push('PAYOUT_DESTINATION_COOLING')
        }
      }
      if (
        context.firstPayout &&
        context.amountMinor !== undefined &&
        context.amountMinor > policy.firstPayoutT3ThresholdMinor
      ) {
        tier = maxTier(tier, 'T3')
        reasons.push('First high-value payout requires T3 minimum.')
      }
      if (context.recentIdentityOrKycChange) tier = maxTier(tier, 'T3')
      if (context.unexpectedThirdPartyDestination) holdCodes.push('UNEXPECTED_THIRD_PARTY_DESTINATION')
      if (context.activeChargeback) holdCodes.push('ACTIVE_CHARGEBACK')
      break
    }

    case 'finance.settlement': {
      if (!policy) {
        holdCodes.push('MARKET_FINANCE_POLICY_MISSING')
        break
      }
      tier = maxTier(tier, tierFromAmount(context.amountMinor, policy.settlement, 'T1'))
      break
    }

    case 'staff.role.change':
    case 'staff.permission.change':
    case 'staff.scope.change': {
      tier = maxTier(tier, 'T3')
      break
    }

    case 'notifications.broadcast': {
      tier = maxTier(tier, 'T2')
      break
    }
  }

  if (policy && context.amountMinor !== undefined) {
    const aggregate24h = context.rollingRecipientAmountMinor24h
    const aggregate7d = context.rollingRecipientAmountMinor7d
    const staff24h = context.rollingStaffAmountMinor24h

    const actionThresholds =
      context.actionId === 'finance.payout'
        ? policy.payout
        : context.actionId === 'finance.settlement'
          ? policy.settlement
          : context.actionId === 'finance.wallet.adjust'
            ? policy.walletAdjustment
            : context.actionId === 'finance.refund' || context.actionId === 'finance.escrow.manual_release'
              ? policy.refund
              : null

    if (actionThresholds) {
      for (const aggregate of [aggregate24h, aggregate7d, staff24h]) {
        if (aggregate !== undefined) {
          tier = maxTier(tier, tierFromAmount(aggregate, actionThresholds, tier))
        }
      }
    }
  }

  if (context.suspectedThresholdSplitting) {
    tier = maxTier(tier, 'T3')
    reasons.push('Threshold-splitting signal escalated approval.')
  }

  if (context.activeDispute && context.actionId === 'finance.payout') {
    holdCodes.push('ACTIVE_DISPUTE')
  }

  if (prohibitCodes.length > 0) {
    return {
      decision: 'PROHIBIT',
      tier,
      reasons,
      holdCodes,
      prohibitCodes,
      policyVersion: CRM_RISK_POLICY_VERSION,
    }
  }

  if (holdCodes.length > 0) {
    return {
      decision: 'HOLD',
      tier,
      reasons,
      holdCodes,
      prohibitCodes,
      policyVersion: CRM_RISK_POLICY_VERSION,
    }
  }

  const decision = tierAtLeast(tier, action.baseTier) && tier !== action.baseTier ? 'ESCALATE' : 'ALLOW'
  return {
    decision,
    tier,
    reasons,
    holdCodes,
    prohibitCodes,
    policyVersion: CRM_RISK_POLICY_VERSION,
  }
}

export function nextTier(tier: ApprovalTier): ApprovalTier {
  return TIERS[Math.min(TIERS.length - 1, TIER_ORDER[tier] + 1)]
}
