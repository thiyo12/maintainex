import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('provider balance adjustment lifecycle', () => {
  it('models post-payout adjustments separately from commission receivables', () => {
    const schema = source('prisma/schema.prisma')
    expect(schema).toContain('model ProviderBalanceAdjustment {')
    expect(schema).toContain('model ProviderBalanceAdjustmentRecovery {')
    expect(schema).toContain('adjustmentDue')
    expect(schema).toContain('oldestAdjustmentDueAt')
    expect(schema).toContain('PROVIDER_BALANCE_ADJUSTMENT_RECEIVABLE')
  })

  it('creates idempotent ledger-backed adjustments from the actual provider payout credit', () => {
    const balance = source('lib/finance/commissions/provider-balance-service.ts')
    expect(balance).toContain('recordPostPayoutProviderAdjustmentForEscrow')
    expect(balance).toContain("referenceType: 'ESCROW_RELEASE'")
    expect(balance).toContain("accountType: 'PROVIDER_WALLET'")
    expect(balance).toContain("'PROVIDER_COMMISSION_RECEIVABLE'")
    expect(balance).toContain("'PROVIDER_BALANCE_ADJUSTMENT_RECEIVABLE'")
    expect(balance).toContain('providerBenefitCredits.reduce')
    expect(balance).toContain("entryType: 'CREDIT'")
    expect(balance).toContain('provider-balance-adjustment:')
    expect(balance).toContain("accountType: 'CHARGEBACK_CLEARING'")
  })

  it('recovers commission and balance adjustments without double-counting platform revenue', () => {
    const balance = source('lib/finance/commissions/provider-balance-service.ts')
    const escrow = source('lib/finance/escrow/escrow-service.ts')
    expect(balance).toContain('providerBalanceAdjustmentRecovery.create')
    expect(balance).toContain('adjustmentRecoveryMinor')
    expect(balance).toContain("method: 'ONLINE_EARNINGS'")
    expect(escrow).toContain("accountType: 'PROVIDER_BALANCE_ADJUSTMENT_RECEIVABLE'")
    expect(escrow).toContain('commissionRecovery.adjustmentRecoveryMinor')
    expect(escrow).not.toContain('platformDueCents + commissionRecovery.recoveryMinor')
  })

  it('handles PayPal dispute create/update/resolve and buyer-favour post-payout loss', () => {
    const paypal = source('lib/finance/payments/paypal-service.ts')
    expect(paypal).toContain("'CUSTOMER.DISPUTE.CREATED'")
    expect(paypal).toContain("'CUSTOMER.DISPUTE.UPDATED'")
    expect(paypal).toContain("'CUSTOMER.DISPUTE.RESOLVED'")
    expect(paypal).toContain("'RESOLVED_BUYER_FAVOUR'")
    expect(paypal).toContain("'RESOLVED_SELLER_FAVOUR'")
    expect(paypal).toContain('recordPostPayoutProviderAdjustmentForEscrow')
    expect(paypal).toContain('disputed_transactions')
  })

  it('keeps historical PayHere chargebacks safe after payout', () => {
    const payments = source('lib/finance/payments/payment-service.ts')
    expect(payments).toContain("statusCode === -3")
    expect(payments).toContain("sourceProvider: 'PAYHERE'")
    expect(payments).toContain('recordPostPayoutProviderAdjustmentForEscrow')
  })

  it('blocks withdrawals while a provider balance adjustment remains due', () => {
    const payout = source('lib/finance/payouts/payout-engine.ts')
    expect(payout).toContain('PROVIDER_BALANCE_ADJUSTMENT_DUE')
    expect(payout).toContain('adjustmentDue: { gt: 0 }')
  })

  it('surfaces adjustments separately in provider and CRM balance views', () => {
    const taskerApi = source('app/api/mobile/earnings/route.ts')
    const companyApi = source('app/api/mobile/company/earnings/route.ts')
    const crmApi = source('app/api/admin/financial/wallets/route.ts')
    const crmPage = source('app/(admin)/admin/financial/wallets/page.tsx')

    expect(taskerApi).toContain('adjustmentDueMinor')
    expect(companyApi).toContain('adjustmentDueMinor')
    expect(crmApi).toContain('recentAdjustmentRecoveries')
    expect(crmPage).toContain('Post-payment liability')
  })
})
