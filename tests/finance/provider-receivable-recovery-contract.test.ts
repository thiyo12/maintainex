import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { calculateOnlineDebtOffset } from '@/lib/finance/commissions/provider-financial-policy'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('provider cash receivable recovery contract', () => {
  it('uses future online earnings without creating a negative provider payout', () => {
    expect(calculateOnlineDebtOffset({
      availableOnlineEarningsMinor: 450_000n,
      commissionDueMinor: 700_000n,
      autoOffsetEnabled: true,
    })).toEqual({
      recoveryMinor: 450_000n,
      providerPayoutMinor: 0n,
      remainingCommissionDueMinor: 250_000n,
    })
  })

  it('does not recover debt when automatic offset is disabled', () => {
    expect(calculateOnlineDebtOffset({
      availableOnlineEarningsMinor: 450_000n,
      commissionDueMinor: 700_000n,
      autoOffsetEnabled: false,
    })).toEqual({
      recoveryMinor: 0n,
      providerPayoutMinor: 450_000n,
      remainingCommissionDueMinor: 700_000n,
    })
  })

  it('allocates recovery against oldest open receivables first', () => {
    const service = source('lib/finance/commissions/provider-balance-service.ts')

    expect(service).toContain("status: { in: ['OPEN', 'PARTIAL'] }")
    expect(service).toContain("orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]")
    expect(service).toContain('remainingToRecover')
    expect(service).toContain('providerCommissionRecovery.create')
    expect(service).toContain('online-recovery:')
  })

  it('records cash completion as a provider receivable', () => {
    const service = source('lib/finance/commissions/provider-balance-service.ts')

    expect(service).toContain("accountType: 'PROVIDER_COMMISSION_RECEIVABLE'")
    expect(service).toContain("entryType: 'DEBIT'")
    expect(service).toContain("referenceType: 'CASH_PLATFORM_RECEIVABLE'")
    expect(service).toContain('providerCommissionReceivable.create')
  })

  it('clears old cash debt from the receivable account instead of crediting platform revenue twice', () => {
    const escrow = source('lib/finance/escrow/escrow-service.ts')

    expect(escrow).toContain("accountType: 'PROVIDER_COMMISSION_RECEIVABLE'")
    expect(escrow).toContain("entryType: 'CREDIT'")
    expect(escrow).toContain('amount: commissionRecovery.recoveryMinor')
    expect(escrow).toContain('amount: providerPayoutCents')
    expect(escrow).toContain('amount: platformDueCents')
    expect(escrow).not.toContain('platformDueCents + commissionRecovery.recoveryMinor')
  })

  it('does not let an alternate funded release path bypass recovery', () => {
    const escrow = source('lib/finance/escrow/escrow-service.ts')
    const calls = escrow.match(/recoverProviderCommissionFromOnlineEarnings\(tx,/g) || []

    expect(calls.length).toBeGreaterThanOrEqual(2)
    expect(escrow).toContain('cashCommissionRecoveryCents')
    expect(escrow).toContain('remainingCashCommissionDueCents')
  })

  it('does not auto-offset a receivable while a direct commission payment is pending', () => {
    const service = source('lib/finance/commissions/provider-balance-service.ts')

    expect(service).toContain("commissionPayments: { none: { status: 'PENDING' } }")
  })

  it('reconciles a confirmed direct payment against the receivable instead of recognizing revenue twice', () => {
    const service = source('lib/finance/commissions/provider-balance-service.ts')
    const route = source('app/api/admin/financial/commission/payments/route.ts')

    expect(service).toContain('settleProviderReceivablesFromDirectPayment')
    expect(service).toContain("accountType: 'PLATFORM_CASH_CLEARING'")
    expect(service).toContain("accountType: 'PROVIDER_COMMISSION_RECEIVABLE'")
    expect(service).toContain("method: 'DIRECT_SETTLEMENT'")
    expect(service).toContain('commission-payment-recovery:')
    expect(route).toContain('remainingReceivableMinor')
    expect(route).toContain('settleProviderReceivablesFromDirectPayment')
    expect(route).toContain('Payment amount does not match the remaining commission due')
  })

  it('keeps cash-job restriction separate from online-job recovery eligibility', () => {
    const policy = source('lib/finance/commissions/provider-financial-policy.ts')
    const balance = source('lib/finance/commissions/provider-balance-service.ts')

    expect(policy).toContain('allowOnlineWhenCashRestricted')
    expect(balance).toContain('cashJobsAllowed')
    expect(balance).toContain('onlineJobsAllowed')
    expect(balance).toContain('PROVIDER_CASH_RESTRICTED')
  })

  it('keeps per-job recovery history idempotent', () => {
    const schema = source('prisma/schema.prisma')
    expect(schema).toContain('model ProviderCommissionReceivable')
    expect(schema).toContain('model ProviderCommissionRecovery')
    expect(schema).toContain('idempotencyKey')
    expect(schema).toContain('sourceEscrowId')
  })
})
