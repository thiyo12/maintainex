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
  const lifecycle = readFile('lib/domain/job-lifecycle.ts')
  const payout = readFile('lib/payout-engine.ts')
  const ledger = readFile('lib/ledger.ts')
  const money = readFile('lib/money.ts')
  const financialRead = readFile('lib/financial-read.ts')

  describe('1. Withdrawal boundaries', () => {
    it('provider payout is enabled only through payout-engine', () => {
      expect(providerWithdraw).toContain('requestPayout')
      expect(providerWithdraw).toContain('Idempotency-Key')
      expect(providerWithdraw).not.toContain('providerWallet.update(')
    })

    it('legacy customer-wallet withdrawal fails closed', () => {
      expect(customerWallet).toContain('CUSTOMER_WITHDRAW_UNAVAILABLE')
      expect(customerWallet).toContain('status: 503')
      expect(customerWallet).not.toContain('customerWallet.update(')
      expect(customerWallet).not.toContain('walletTransaction.create(')
    })

    it('top-up remains unavailable until a payment gateway exists', () => {
      expect(customerWallet).toContain('status: 501')
    })
  })

  describe('2. Money conversion safety', () => {
    it('BigInt conversion helper checks safe range', () => {
      expect(money).toContain('bigIntToSafeNumber')
      expect(money).toContain('MAX_SAFE_INTEGER')
      expect(money).toContain('MIN_SAFE_INTEGER')
    })

    it('ledger converts minor-unit BigInt through the safe helper', () => {
      expect(ledger).toContain('bigIntToSafeNumber')
      expect(ledger).not.toMatch(/const\s+deltaMajor\s*=\s*Number\(/)
    })

    it('canonical balance reads convert major-unit cache values to minor BigInt', () => {
      expect(financialRead).toContain('majorNumberToMinor')
      expect(financialRead).toContain('Math.round(value * 100)')
      expect(financialRead).not.toContain('balance: BigInt(row.balance)')
    })
  })

  describe('3. Escrow route ownership', () => {
    it('customer refund route delegates to refundEscrow', () => {
      expect(refundRoute).toContain('refundEscrow')
      expect(refundRoute).not.toContain('customerWallet.update(')
    })

    it('admin release/refund delegate to canonical lifecycle', () => {
      expect(adminEscrows).toContain('releaseEscrow')
      expect(adminEscrows).toContain('refundEscrow')
      expect(adminEscrows).not.toContain('providerWallet.upsert(')
      expect(adminEscrows).not.toContain('customerWallet.update(')
    })

    it('cron release delegates to canonical releaseEscrow', () => {
      expect(cron).toContain('releaseEscrow')
      expect(cron).not.toContain('providerWallet.upsert(')
    })

    it('cash settlement is explicitly disabled instead of creating unfunded money', () => {
      expect(cash).toContain('CASH_PAYMENT_DISABLED')
      expect(cash).toContain('status: 503')
      expect(cash).not.toContain('providerWallet.upsert(')
    })
  })

  describe('4. Compatibility shadow writes are bounded', () => {
    it('lifecycle has canonical ledger writes before compatibility mirrors', () => {
      expect(lifecycle).toContain('postLedgerTransaction')
      expect(lifecycle).toContain("referenceType: 'ESCROW_DEPOSIT'")
      expect(lifecycle).toContain("referenceType: 'ESCROW_RELEASE'")
      expect(lifecycle).toContain("referenceType: 'ESCROW_REFUND'")
    })

    it('property boost labels its compatibility shadow and keeps it transactional', () => {
      expect(boost).toContain('LEGACY_SHADOW_WRITE')
      expect(boost).toContain('prisma.$transaction(async (tx)')
      expect(boost).toContain('postLedgerTransaction')
      expect(boost).toContain('}, tx)')
    })
  })

  describe('5. Property boost payment integrity', () => {
    it('price comes from server-side BOOST_TIERS', () => {
      expect(boost).toContain('BOOST_TIERS')
      expect(boost).toContain('tierConfig = BOOST_TIERS[')
    })

    it('wallet payment requires a bounded idempotency key', () => {
      expect(boost).toContain('idempotency-key')
      expect(boost).toContain('idempotencyKey.length > 255')
      expect(boost).toContain('property-boost:${id}:${session.id}:${idempotencyKey}')
    })

    it('unimplemented external/CAD paths fail closed', () => {
      expect(boost).toContain('BOOST_PAYMENT_UNAVAILABLE')
      expect(boost).toContain('WALLET_CURRENCY_UNAVAILABLE')
    })
  })

  describe('6. Ledger + WalletBalance atomicity', () => {
    it('WalletBalance updates occur inside postLedgerTransaction', () => {
      expect(ledger).toContain('walletUpdates')
      expect(ledger).toContain('new Map')
      expect(ledger).toContain('WalletBalance')
      expect(ledger).toContain('ON CONFLICT ("walletType", "walletId")')
    })

    it('debit uses one atomic sufficiency-checked UPDATE', () => {
      expect(ledger).toContain('"balance" = "balance" - $3')
      expect(ledger).toContain('"availableBalance" = "availableBalance" - $3')
      expect(ledger).toContain('AND "balance" >= $3 AND "availableBalance" >= $3')
      expect(ledger).toContain("if (affected === 0) throw new Error('INSUFFICIENT_FUNDS')")
    })

    it('credit uses parameterized SQL and atomic increment', () => {
      expect(ledger).toContain('"balance" = "WalletBalance"."balance" + $3')
      expect(ledger).toContain('"availableBalance" = "WalletBalance"."availableBalance" + $3')
      expect(ledger).toContain('$1')
      expect(ledger).toContain('$2')
      expect(ledger).toContain('$3')
    })
  })

  describe('7. Payout accounting', () => {
    it('reservation debits provider and credits payout clearing', () => {
      expect(payout).toContain("accountType: 'PROVIDER_WALLET'")
      expect(payout).toContain("accountType: 'PAYOUT_CLEARING'")
      expect(payout).toContain("referenceType: 'WITHDRAWAL_RESERVED'")
    })

    it('successful payout clears to explicit external account', () => {
      expect(payout).toContain("accountType: 'EXTERNAL_PAYOUT'")
      expect(payout).toContain("referenceType: 'PAYOUT_SUCCEEDED'")
    })

    it('failed/cancelled payout restores provider funds', () => {
      expect(payout).toContain('restoreReservedPayout')
      expect(payout).toContain("referenceType: 'WITHDRAWAL_RELEASED'")
    })
  })
})
