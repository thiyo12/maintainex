import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const readFile = (relPath: string) => readFileSync(join(ROOT, relPath), 'utf-8')

describe('Phase 5E — Financial Atomicity Guard', () => {
  const walletRoute = readFile('app/api/mobile/v2/wallet/route.ts')
  const providerWithdraw = readFile('app/api/mobile/withdraw/route.ts')
  const refundRoute = readFile('app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts')
  const adminEscrows = readFile('app/api/mobile/v2/admin/escrows/route.ts')
  const cronRelease = readFile('app/api/cron/escrow-release/route.ts')
  const cashPayment = readFile('app/api/mobile/v2/jobs/[id]/cash-payment/route.ts')
  const boostRoute = readFile('app/api/properties/[id]/boost/route.ts')
  const lifecycle = readFile('lib/domain/job-lifecycle.ts')
  const ledger = readFile('lib/ledger.ts')

  describe('Reachable routes use canonical financial writers', () => {
    it('legacy customer withdrawal fails closed without balance mutation', () => {
      expect(walletRoute).toContain('CUSTOMER_WITHDRAW_UNAVAILABLE')
      expect(walletRoute).toContain('status: 503')
      expect(walletRoute).not.toMatch(/data:\s*\{\s*balance:\s*newBalance/)
      expect(walletRoute).not.toContain('customerWallet.update(')
    })

    it('provider withdrawal uses canonical payout engine + idempotency', () => {
      expect(providerWithdraw).toContain("requestPayout")
      expect(providerWithdraw).toContain("idempotency-key")
      expect(providerWithdraw).not.toContain('providerWallet.update(')
      expect(providerWithdraw).not.toContain('customerWallet.update(')
    })

    it('refund route delegates to refundEscrow', () => {
      expect(refundRoute).toContain('refundEscrow')
      expect(refundRoute).not.toContain('customerWallet.update(')
      expect(refundRoute).not.toContain('walletTransaction.create(')
    })

    it('admin escrow actions delegate to lifecycle writers', () => {
      expect(adminEscrows).toContain('releaseEscrow')
      expect(adminEscrows).toContain('refundEscrow')
      expect(adminEscrows).not.toContain('providerWallet.upsert(')
      expect(adminEscrows).not.toContain('customerWallet.update(')
      expect(adminEscrows).not.toContain('walletTransaction.create(')
    })

    it('cron auto-release delegates to releaseEscrow', () => {
      expect(cronRelease).toContain('releaseEscrow')
      expect(cronRelease).not.toContain('providerWallet.upsert(')
      expect(cronRelease).not.toContain('walletTransaction.create(')
    })

    it('cash settlement fails closed until funded accounting exists', () => {
      expect(cashPayment).toContain('CASH_PAYMENT_DISABLED')
      expect(cashPayment).toContain('status: 503')
      expect(cashPayment).not.toContain('providerWallet.upsert(')
      expect(cashPayment).not.toContain('postLedgerTransaction')
    })
  })

  describe('Property boost is atomically ledger-backed', () => {
    it('server controls tier price and unsupported payment methods fail closed', () => {
      expect(boostRoute).toContain('BOOST_TIERS')
      expect(boostRoute).toContain('BOOST_PAYMENT_UNAVAILABLE')
      expect(boostRoute).toContain('WALLET_CURRENCY_UNAVAILABLE')
    })

    it('wallet boost requires idempotency and posts a ledger debit', () => {
      expect(boostRoute).toContain('idempotency-key')
      expect(boostRoute).toContain('postLedgerTransaction')
      expect(boostRoute).toContain("referenceType: 'PROPERTY_BOOST'")
      expect(boostRoute).toContain("accountType: 'CUSTOMER_WALLET'")
    })

    it('ledger + compatibility shadow + boost creation share one transaction', () => {
      expect(boostRoute).toContain('prisma.$transaction(async (tx)')
      expect(boostRoute).toContain('}, tx)')
      expect(boostRoute).toContain('LEGACY_SHADOW_WRITE')
      expect(boostRoute).toContain('tx.propertyBoost.create')
      expect(boostRoute).toContain('tx.realEstateListing.update')
    })
  })

  describe('Canonical lifecycle owns escrow money', () => {
    it('fund/release/refund post through FinancialLedger', () => {
      expect(lifecycle).toContain('postLedgerTransaction')
      expect(lifecycle).toContain("referenceType: 'ESCROW_DEPOSIT'")
      expect(lifecycle).toContain("referenceType: 'ESCROW_RELEASE'")
      expect(lifecycle).toContain("referenceType: 'ESCROW_REFUND'")
    })

    it('escrow state claims are compare-and-set guarded', () => {
      expect(lifecycle).toContain('updateMany')
      expect(lifecycle).toContain('Escrow state changed concurrently')
    })
  })

  describe('Ledger fails closed and updates WalletBalance atomically', () => {
    it('uses one DB transaction and an idempotency record', () => {
      expect(ledger).toContain('idempotencyRecord')
      expect(ledger).toContain('prisma.$transaction')
      expect(ledger).toContain('WalletBalance')
    })

    it('debits require sufficient balance in the same UPDATE', () => {
      expect(ledger).toContain('AND "balance" >= $3 AND "availableBalance" >= $4')
      expect(ledger).toContain("if (affected === 0) throw new Error('INSUFFICIENT_FUNDS')")
    })

    it('financial transaction IDs use randomUUID, not Math.random', () => {
      expect(ledger).toContain('randomUUID')
      expect(ledger).not.toContain('Math.random')
    })

    it('does not suppress missing-table/database errors', () => {
      expect(ledger).not.toMatch(/P1000/)
      expect(ledger).not.toMatch(/does not exist.*return/)
    })
  })
})
