import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const readFile = (relPath: string) => readFileSync(join(ROOT, relPath), 'utf-8')

describe('Phase 5E.1 — Canonical Financial Truth Closure', () => {
  const providerWithdraw = readFile('app/api/mobile/withdraw/route.ts')
  const customerWallet = readFile('app/api/mobile/v2/wallet/route.ts')
  const refundRoute = readFile('app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts')
  const adminEscrows = readFile('app/api/mobile/v2/admin/escrows/route.ts')
  const cron = readFile('app/api/cron/escrow-release/route.ts')
  const cash = readFile('app/api/mobile/v2/jobs/[id]/cash-payment/route.ts')
  const boost = readFile('app/api/properties/[id]/boost/route.ts')
  const lifecycle = readFile('lib/finance/escrow/escrow-service.ts')
  const payout = readFile('lib/payout-engine.ts')
  const ledger = readFile('lib/ledger.ts')
  const money = readFile('lib/shared/money/money.ts')
  const financialRead = readFile('lib/financial-read.ts')

  it('provider withdrawal uses payout-engine with required idempotency', () => {
    expect(providerWithdraw).toContain('requestPayout')
    expect(providerWithdraw).toContain('Idempotency-Key')
    expect(providerWithdraw).not.toContain('providerWallet.update(')
  })

  it('legacy customer withdrawal fails closed without financial side effects', () => {
    expect(customerWallet).toContain('CUSTOMER_WITHDRAW_UNAVAILABLE')
    expect(customerWallet).toContain('status: 503')
    expect(customerWallet).not.toContain('customerWallet.update(')
    expect(customerWallet).not.toContain('walletTransaction.create(')
  })

  it('escrow refund/admin/cron routes delegate to canonical lifecycle writers', () => {
    expect(refundRoute).toContain('refundEscrow')
    expect(adminEscrows).toContain('releaseEscrow')
    expect(adminEscrows).toContain('refundEscrow')
    expect(cron).toContain('completeAndReleaseEscrow')
    expect(refundRoute).not.toContain('customerWallet.update(')
    expect(adminEscrows).not.toContain('providerWallet.upsert(')
    expect(cron).not.toContain('providerWallet.upsert(')
  })

  it('cash settlement fails closed instead of creating unfunded wallet money', () => {
    expect(cash).toContain('CASH_PAYMENT_DISABLED')
    expect(cash).toContain('status: 503')
    expect(cash).not.toContain('providerWallet.upsert(')
  })

  it('canonical lifecycle posts deposit, release and refund through the ledger', () => {
    expect(lifecycle).toContain('postLedgerTransaction')
    expect(lifecycle).toContain("referenceType: 'ESCROW_DEPOSIT'")
    expect(lifecycle).toContain("referenceType: 'ESCROW_RELEASE'")
    expect(lifecycle).toContain("referenceType: 'ESCROW_REFUND'")
  })

  it('BigInt conversion helpers protect the major/minor boundary', () => {
    expect(money).toContain('bigIntToSafeNumber')
    expect(money).toContain('MAX_SAFE_INTEGER')
    expect(financialRead).toContain('legacyToMinorUnits')
    expect(financialRead).toContain('legacyToCanonicalMinor')
  })

  it('property boost is ledger-backed and transactionally mirrors legacy state', () => {
    expect(boost).toContain('postLedgerTransaction')
    expect(boost).toContain('prisma.$transaction(async (tx)')
    expect(boost).toContain('LEGACY_SHADOW_WRITE')
    expect(boost).toContain('tx.propertyBoost.create')
    expect(boost).toContain('tx.realEstateListing.update')
  })

  it('property boost uses operation-level and ledger-level idempotency', () => {
    expect(boost).toContain('property-boost-op:${id}:${session.id}:${idempotencyKey}')
    expect(boost).toContain('property-boost-ledger:${id}:${session.id}:${idempotencyKey}')
    expect(boost).toContain('pg_advisory_xact_lock')
    expect(boost).toContain("operation: 'PROPERTY_BOOST'")
    expect(boost).toContain('IDEMPOTENCY_CONFLICT')
  })

  it('property boost rejects unimplemented payment/currency paths', () => {
    expect(boost).toContain('BOOST_TIERS')
    expect(boost).toContain('BOOST_PAYMENT_UNAVAILABLE')
    expect(boost).toContain('WALLET_CURRENCY_UNAVAILABLE')
  })

  it('ledger debit is atomic and fails closed on insufficient funds', () => {
    expect(ledger).toContain('"balance" = "balance" - $3')
    expect(ledger).toContain('"availableBalance" = "availableBalance" - $4')
    expect(ledger).toContain('AND "balance" >= $3 AND "availableBalance" >= $4')
    expect(ledger).toContain("throw new Error('INSUFFICIENT_FUNDS')")
    expect(ledger).not.toContain('Math.random')
  })

  it('ledger credit uses parameterized atomic upsert', () => {
    expect(ledger).toContain('ON CONFLICT ("walletType", "walletId", "currency")')
    expect(ledger).toContain('"balance" = "WalletBalance"."balance" + $3')
    expect(ledger).toContain('"availableBalance" = "WalletBalance"."availableBalance" + $4')
    expect(ledger).toContain('randomUUID')
  })

  it('payout reserves, clears externally, and restores on failure/cancel', () => {
    expect(payout).toContain("referenceType: 'WITHDRAWAL_RESERVED'")
    expect(payout).toContain("accountType: 'PAYOUT_CLEARING'")
    expect(payout).toContain("referenceType: 'PAYOUT_SUCCEEDED'")
    expect(payout).toContain("accountType: 'EXTERNAL_PAYOUT'")
    expect(payout).toContain('restoreReservedPayout')
    expect(payout).toContain("referenceType: 'WITHDRAWAL_RELEASED'")
  })
})
