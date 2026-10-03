export type ProviderFinancialStanding =
  | 'CLEAR'
  | 'WARNING'
  | 'CASH_RESTRICTED'
  | 'REVIEW_REQUIRED'

export type ProviderFinancialPolicy = {
  warningThresholdMinor: bigint
  cashRestrictionThresholdMinor: bigint
  reviewThresholdMinor: bigint
  maxDebtAgeDays: number
  allowOnlineWhenCashRestricted: boolean
  autoOffsetOnlineEarnings: boolean
}

export type ProviderFinancialSnapshot = {
  commissionDueMinor: bigint
  oldestCommissionDueAt?: Date | null
}

export type ProviderFinancialDecision = {
  standing: ProviderFinancialStanding
  cashJobsAllowed: boolean
  onlineJobsAllowed: boolean
  manualReviewRequired: boolean
  reason: string | null
  debtAgeDays: number
}

function wholeDaysBetween(from: Date, to: Date): number {
  const diff = Math.max(0, to.getTime() - from.getTime())
  return Math.floor(diff / (24 * 60 * 60 * 1000))
}

export function validateProviderFinancialPolicy(
  policy: ProviderFinancialPolicy,
): void {
  const values = [
    policy.warningThresholdMinor,
    policy.cashRestrictionThresholdMinor,
    policy.reviewThresholdMinor,
  ]
  if (values.some(value => value < 0n)) {
    throw new Error('Provider financial thresholds cannot be negative')
  }
  if (
    policy.warningThresholdMinor > policy.cashRestrictionThresholdMinor ||
    policy.cashRestrictionThresholdMinor > policy.reviewThresholdMinor
  ) {
    throw new Error('Provider financial thresholds must be monotonic')
  }
  if (!Number.isInteger(policy.maxDebtAgeDays) || policy.maxDebtAgeDays < 1) {
    throw new Error('Provider financial max debt age must be a positive whole number of days')
  }
}

export function evaluateProviderFinancialStanding(
  snapshot: ProviderFinancialSnapshot,
  policy: ProviderFinancialPolicy,
  now: Date = new Date(),
): ProviderFinancialDecision {
  validateProviderFinancialPolicy(policy)

  const commissionDueMinor = snapshot.commissionDueMinor > 0n
    ? snapshot.commissionDueMinor
    : 0n
  const debtAgeDays = snapshot.oldestCommissionDueAt
    ? wholeDaysBetween(snapshot.oldestCommissionDueAt, now)
    : 0

  if (commissionDueMinor === 0n) {
    return {
      standing: 'CLEAR',
      cashJobsAllowed: true,
      onlineJobsAllowed: true,
      manualReviewRequired: false,
      reason: null,
      debtAgeDays: 0,
    }
  }

  if (
    commissionDueMinor >= policy.reviewThresholdMinor ||
    debtAgeDays >= policy.maxDebtAgeDays
  ) {
    return {
      standing: 'REVIEW_REQUIRED',
      cashJobsAllowed: false,
      onlineJobsAllowed: policy.allowOnlineWhenCashRestricted,
      manualReviewRequired: true,
      reason:
        commissionDueMinor >= policy.reviewThresholdMinor
          ? 'Outstanding commission reached the manual-review threshold'
          : 'Outstanding commission is overdue',
      debtAgeDays,
    }
  }

  if (commissionDueMinor >= policy.cashRestrictionThresholdMinor) {
    return {
      standing: 'CASH_RESTRICTED',
      cashJobsAllowed: false,
      onlineJobsAllowed: policy.allowOnlineWhenCashRestricted,
      manualReviewRequired: false,
      reason: 'Outstanding commission reached the cash-job restriction threshold',
      debtAgeDays,
    }
  }

  if (commissionDueMinor >= policy.warningThresholdMinor) {
    return {
      standing: 'WARNING',
      cashJobsAllowed: true,
      onlineJobsAllowed: true,
      manualReviewRequired: false,
      reason: 'Outstanding commission reached the warning threshold',
      debtAgeDays,
    }
  }

  return {
    standing: 'CLEAR',
    cashJobsAllowed: true,
    onlineJobsAllowed: true,
    manualReviewRequired: false,
    reason: null,
    debtAgeDays,
  }
}

export function calculateCashPlatformReceivable(input: {
  providerAmountMinor: bigint
  serviceFeeMinor: bigint
  commissionRateBps: number
}): {
  commissionMinor: bigint
  platformReceivableMinor: bigint
} {
  if (input.providerAmountMinor < 0n || input.serviceFeeMinor < 0n) {
    throw new Error('Cash receivable amounts cannot be negative')
  }
  if (
    !Number.isInteger(input.commissionRateBps) ||
    input.commissionRateBps < 0 ||
    input.commissionRateBps > 10000
  ) {
    throw new Error('Commission rate must be between 0 and 10000 basis points')
  }

  const commissionMinor =
    (input.providerAmountMinor * BigInt(input.commissionRateBps)) / 10000n

  return {
    commissionMinor,
    platformReceivableMinor: commissionMinor + input.serviceFeeMinor,
  }
}

export function calculateOnlineDebtOffset(input: {
  availableOnlineEarningsMinor: bigint
  commissionDueMinor: bigint
  autoOffsetEnabled: boolean
}): {
  recoveryMinor: bigint
  providerPayoutMinor: bigint
  remainingCommissionDueMinor: bigint
} {
  const earnings = input.availableOnlineEarningsMinor > 0n
    ? input.availableOnlineEarningsMinor
    : 0n
  const due = input.commissionDueMinor > 0n
    ? input.commissionDueMinor
    : 0n

  if (!input.autoOffsetEnabled || earnings === 0n || due === 0n) {
    return {
      recoveryMinor: 0n,
      providerPayoutMinor: earnings,
      remainingCommissionDueMinor: due,
    }
  }

  const recoveryMinor = earnings < due ? earnings : due
  return {
    recoveryMinor,
    providerPayoutMinor: earnings - recoveryMinor,
    remainingCommissionDueMinor: due - recoveryMinor,
  }
}
