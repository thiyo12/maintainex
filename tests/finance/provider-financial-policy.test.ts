import { describe, expect, it } from 'vitest'
import {
  calculateCashPlatformReceivable,
  calculateOnlineDebtOffset,
  evaluateProviderFinancialStanding,
  type ProviderFinancialPolicy,
} from '@/lib/finance/commissions/provider-financial-policy'

const policy: ProviderFinancialPolicy = {
  warningThresholdMinor: 200_000n,
  cashRestrictionThresholdMinor: 500_000n,
  reviewThresholdMinor: 1_000_000n,
  maxDebtAgeDays: 14,
  allowOnlineWhenCashRestricted: true,
  autoOffsetOnlineEarnings: true,
}

describe('provider financial policy', () => {
  it('keeps a provider clear when no commission is due', () => {
    expect(evaluateProviderFinancialStanding({ commissionDueMinor: 0n }, policy)).toMatchObject({
      standing: 'CLEAR',
      cashJobsAllowed: true,
      onlineJobsAllowed: true,
    })
  })

  it('warns below the cash restriction threshold', () => {
    expect(evaluateProviderFinancialStanding({ commissionDueMinor: 250_000n }, policy)).toMatchObject({
      standing: 'WARNING',
      cashJobsAllowed: true,
      onlineJobsAllowed: true,
    })
  })

  it('blocks cash jobs but keeps online jobs available for recovery', () => {
    expect(evaluateProviderFinancialStanding({ commissionDueMinor: 500_000n }, policy)).toMatchObject({
      standing: 'CASH_RESTRICTED',
      cashJobsAllowed: false,
      onlineJobsAllowed: true,
      manualReviewRequired: false,
    })
  })

  it('requires review at the review threshold', () => {
    expect(evaluateProviderFinancialStanding({ commissionDueMinor: 1_000_000n }, policy)).toMatchObject({
      standing: 'REVIEW_REQUIRED',
      cashJobsAllowed: false,
      onlineJobsAllowed: true,
      manualReviewRequired: true,
    })
  })

  it('requires review when debt is too old even if the amount is smaller', () => {
    const now = new Date('2026-10-20T00:00:00Z')
    const oldest = new Date('2026-10-01T00:00:00Z')
    expect(
      evaluateProviderFinancialStanding(
        { commissionDueMinor: 100_000n, oldestCommissionDueAt: oldest },
        policy,
        now,
      ),
    ).toMatchObject({
      standing: 'REVIEW_REQUIRED',
      cashJobsAllowed: false,
      manualReviewRequired: true,
      debtAgeDays: 19,
    })
  })

  it('calculates cash commission plus service fee as the platform receivable', () => {
    expect(calculateCashPlatformReceivable({
      providerAmountMinor: 1_000_000n,
      serviceFeeMinor: 100_000n,
      commissionRateBps: 1000,
    })).toEqual({
      commissionMinor: 100_000n,
      platformReceivableMinor: 200_000n,
    })
  })

  it('recovers old cash commission from future online earnings without exceeding earnings', () => {
    expect(calculateOnlineDebtOffset({
      availableOnlineEarningsMinor: 1_200_000n,
      commissionDueMinor: 500_000n,
      autoOffsetEnabled: true,
    })).toEqual({
      recoveryMinor: 500_000n,
      providerPayoutMinor: 700_000n,
      remainingCommissionDueMinor: 0n,
    })
  })

  it('never creates a negative provider payout when debt exceeds earnings', () => {
    expect(calculateOnlineDebtOffset({
      availableOnlineEarningsMinor: 300_000n,
      commissionDueMinor: 500_000n,
      autoOffsetEnabled: true,
    })).toEqual({
      recoveryMinor: 300_000n,
      providerPayoutMinor: 0n,
      remainingCommissionDueMinor: 200_000n,
    })
  })
})
