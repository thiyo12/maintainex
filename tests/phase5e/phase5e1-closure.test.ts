import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')

function readFile(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf-8')
}

describe('Phase 5E.1 — Canonical Financial Truth Closure', () => {

  describe('1. WITHDRAWAL MUST BE DISABLED', () => {
    it('v1 withdraw route returns 503', () => {
      const route = readFile('app/api/mobile/withdraw/route.ts')
      expect(route).toContain('503')
      expect(route).not.toContain('prisma')
    })

    it('v2 wallet WITHDRAW returns 503 with zero financial side effects', () => {
      const route = readFile('app/api/mobile/v2/wallet/route.ts')
      expect(route).toContain("status: 503")
      expect(route).toContain('Withdrawals are temporarily unavailable')
      const withdrawSection = route.substring(route.indexOf("action === 'WITHDRAW'"))
      expect(withdrawSection).not.toContain('prisma')
      expect(withdrawSection).not.toContain('postLedgerTransaction')
      expect(withdrawSection).not.toContain('customerWallet.update')
      expect(withdrawSection).not.toContain('walletTransaction.create')
    })

    it('v2 wallet POST has no ledger import (withdrawal disabled)', () => {
      const route = readFile('app/api/mobile/v2/wallet/route.ts')
      expect(route).not.toContain("import { postLedgerTransaction")
    })

    it('v2 wallet TOP_UP returns 501 (dead)', () => {
      const route = readFile('app/api/mobile/v2/wallet/route.ts')
      const topUpSection = route.substring(route.indexOf("action === 'TOP_UP'"))
      expect(topUpSection).toContain('501')
    })
  })

  describe('2. WITHDRAWAL SIDE-EFFECT TEST', () => {
    it('wallet route POST with WITHDRAW action hits 503 before any DB operation', () => {
      const route = readFile('app/api/mobile/v2/wallet/route.ts')
      const postFn = route.substring(route.indexOf('export async function POST'))
      const withdrawIdx = postFn.indexOf("action === 'WITHDRAW'")
      const firstPrismaIdx = postFn.indexOf('prisma.')
      expect(withdrawIdx).toBeGreaterThan(0)
      if (firstPrismaIdx > 0) {
        expect(withdrawIdx).toBeLessThan(firstPrismaIdx)
      }
    })
  })

  describe('3. BIGINT → NUMBER CONVERSIONS', () => {
    it('bigIntToSafeNumber exists in money.ts with MAX_SAFE_INTEGER check', () => {
      const money = readFile('lib/money.ts')
      expect(money).toContain('bigIntToSafeNumber')
      expect(money).toContain('MAX_SAFE_INTEGER')
      expect(money).toContain('MIN_SAFE_INTEGER')
      expect(money).toContain('precision would be lost')
    })

    it('ledger.ts uses bigIntToSafeNumber not ad-hoc Number()', () => {
      const ledger = readFile('lib/ledger.ts')
      expect(ledger).toContain('bigIntToSafeNumber')
      expect(ledger).not.toMatch(/const delta = Number\(/)
    })

    it('refund route uses bigIntToSafeNumber', () => {
      const refund = readFile('app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts')
      expect(refund).toContain('bigIntToSafeNumber')
      expect(refund).toContain("import { bigIntToSafeNumber } from '@/lib/money'")
    })

    it('admin escrows uses bigIntToSafeNumber', () => {
      const admin = readFile('app/api/mobile/v2/admin/escrows/route.ts')
      expect(admin).toContain('bigIntToSafeNumber')
      expect(admin).toContain("import { bigIntToSafeNumber } from '@/lib/money'")
    })

    it('cron escrow-release uses bigIntToSafeNumber', () => {
      const cron = readFile('app/api/cron/escrow-release/route.ts')
      expect(cron).toContain('bigIntToSafeNumber')
      expect(cron).toContain("import { bigIntToSafeNumber } from '@/lib/money'")
    })

    it('cash-payment uses bigIntToSafeNumber', () => {
      const cash = readFile('app/api/mobile/v2/jobs/[id]/cash-payment/route.ts')
      expect(cash).toContain('bigIntToSafeNumber')
      expect(cash).toContain("import { bigIntToSafeNumber } from '@/lib/money'")
    })

    it('job-lifecycle uses bigIntToSafeNumber for all BigInt→Number', () => {
      const lifecycle = readFile('lib/domain/job-lifecycle.ts')
      expect(lifecycle).toContain('bigIntToSafeNumber')
      expect(lifecycle).toContain("import { bigIntToSafeNumber } from '@/lib/money'")
    })
  })

  describe('4. LEGACY FLOAT SHADOW WRITES', () => {
    it('boost route labels legacy shadow write', () => {
      const boost = readFile('app/api/properties/[id]/boost/route.ts')
      expect(boost).toContain('LEGACY_SHADOW_WRITE')
    })

    it('all legacy Float writers still exist (shadow compatibility)', () => {
      const refund = readFile('app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts')
      expect(refund).toContain('customerWallet.update')
    })

    it('all legacy Float writers still exist in admin escrows', () => {
      const admin = readFile('app/api/mobile/v2/admin/escrows/route.ts')
      expect(admin).toContain('providerWallet.upsert')
      expect(admin).toContain('customerWallet.update')
    })

    it('all legacy Float writers still exist in job-lifecycle', () => {
      const lifecycle = readFile('lib/domain/job-lifecycle.ts')
      expect(lifecycle).toContain('customerWallet.update')
      expect(lifecycle).toContain('providerWallet.upsert')
    })

    it('all legacy Float writers still exist in cron', () => {
      const cron = readFile('app/api/cron/escrow-release/route.ts')
      expect(cron).toContain('providerWallet.upsert')
    })

    it('all legacy Float writers still exist in cash-payment', () => {
      const cash = readFile('app/api/mobile/v2/jobs/[id]/cash-payment/route.ts')
      expect(cash).toContain('providerWallet.upsert')
    })
  })

  describe('5. BOOST ROUTE ATOMICITY', () => {
    it('boost wallet operations wrapped in $transaction', () => {
      const boost = readFile('app/api/properties/[id]/boost/route.ts')
      const walletSection = boost.substring(boost.indexOf("paymentMethod === 'wallet'"))
      expect(walletSection).toContain('prisma.$transaction(async (tx)')
      expect(walletSection).toContain('}, tx)')
    })

    it('boost amount comes from server-side BOOST_TIERS (not client)', () => {
      const boost = readFile('app/api/properties/[id]/boost/route.ts')
      expect(boost).toContain('BOOST_TIERS')
      expect(boost).toContain("tierConfig = BOOST_TIERS[")
    })

    it('boost posts ledger with idempotency key', () => {
      const boost = readFile('app/api/properties/[id]/boost/route.ts')
      expect(boost).toContain('postLedgerTransaction')
      expect(boost).toContain('property-boost:${id}:${session.id}')
    })
  })

  describe('6. LEDGER + WALLETBALANCE ATOMICITY', () => {
    it('postLedgerTransaction updates WalletBalance in same DB transaction', () => {
      const ledger = readFile('lib/ledger.ts')
      expect(ledger).toContain('$executeRawUnsafe')
      expect(ledger).toContain('WalletBalance')
      expect(ledger).toContain('ON CONFLICT')
    })

    it('WalletBalance updates aggregated per account (not per entry)', () => {
      const ledger = readFile('lib/ledger.ts')
      expect(ledger).toContain('walletUpdates')
      expect(ledger).toContain('new Map')
    })
  })

  describe('7. CANONICAL BALANCE READERS', () => {
    it('job-lifecycle reads canonical balance (not legacy Float)', () => {
      const lifecycle = readFile('lib/domain/job-lifecycle.ts')
      expect(lifecycle).toContain('readCanonicalCustomerBalance')
      expect(lifecycle).toContain('readCanonicalProviderBalance')
    })

    it('cron reads canonical balance', () => {
      const cron = readFile('app/api/cron/escrow-release/route.ts')
      expect(cron).toContain('readCanonicalProviderBalance')
    })

    it('cash-payment reads canonical balance', () => {
      const cash = readFile('app/api/mobile/v2/jobs/[id]/cash-payment/route.ts')
      expect(cash).toContain('readCanonicalProviderBalance')
    })

    it('admin escrows reads canonical balances', () => {
      const admin = readFile('app/api/mobile/v2/admin/escrows/route.ts')
      expect(admin).toContain('readCanonicalProviderBalance')
      expect(admin).toContain('readCanonicalCustomerBalance')
    })
  })

  describe('8. RAW SQL UPSERT REVIEW', () => {
    it('uses parameterized SQL ($1-$4)', () => {
      const ledger = readFile('lib/ledger.ts')
      expect(ledger).toContain('$1')
      expect(ledger).toContain('$2')
      expect(ledger).toContain('$3')
      expect(ledger).toContain('$4')
    })

    it('ON CONFLICT on correct unique constraint (walletType, walletId)', () => {
      const ledger = readFile('lib/ledger.ts')
      expect(ledger).toContain('ON CONFLICT ("walletType", "walletId")')
    })

    it('atomic increment/decrement via single UPDATE statement', () => {
      const ledger = readFile('lib/ledger.ts')
      expect(ledger).toContain('"availableBalance" = "WalletBalance"."availableBalance" + $4')
      expect(ledger).toContain('"balance" = "WalletBalance"."balance" + $3')
      expect(ledger).toContain('"balance" = "balance" - $3')
      expect(ledger).toContain('"availableBalance" = "availableBalance" - $4')
    })

    it('no raw string interpolation in SQL parameter blocks', () => {
      const ledger = readFile('lib/ledger.ts')
      const creditIdx = ledger.indexOf('INSERT INTO "WalletBalance"')
      const creditEndIdx = ledger.indexOf('}', creditIdx)
      const creditSql = ledger.substring(creditIdx, creditEndIdx)
      expect(creditSql).not.toMatch(/\$\{.*\}/)
      expect(creditSql).toContain('$1')
      expect(creditSql).toContain('$2')

      const debitIdx = ledger.indexOf('UPDATE "WalletBalance"')
      const debitEndIdx = ledger.indexOf('}', debitIdx)
      const debitSql = ledger.substring(debitIdx, debitEndIdx)
      expect(debitSql).not.toMatch(/\$\{.*\}/)
      expect(debitSql).toContain('$1')
      expect(debitSql).toContain('$2')
    })

    it('DEBIT path checks balance sufficiency atomically', () => {
      const ledger = readFile('lib/ledger.ts')
      expect(ledger).toContain('AND "balance" >= $3 AND "availableBalance" >= $4')
      expect(ledger).toContain("if (affected === 0)")
      expect(ledger).toContain("'INSUFFICIENT_FUNDS'")
    })

    it('DEBIT path has no P1000 or does-not-exist catch — fails closed', () => {
      const ledger = readFile('lib/ledger.ts')
      const debitIdx = ledger.indexOf('UPDATE "WalletBalance"')
      const lines = ledger.substring(debitIdx, debitIdx + 800)
      expect(lines).not.toContain('P1000')
      expect(lines).not.toContain("'does not exist'")
      expect(lines).not.toMatch(/catch\s*\(/)
    })
  })
})
