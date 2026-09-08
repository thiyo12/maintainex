import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')

function readFile(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf-8')
}

describe('Phase 5E — Financial Atomicity Guard', () => {
  describe('No direct balance mutations without ledger', () => {
    const walletRoute = readFile('app/api/mobile/v2/wallet/route.ts')
    const refundRoute = readFile('app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts')
    const adminEscrows = readFile('app/api/mobile/v2/admin/escrows/route.ts')

    it('wallet/route.ts withdrawal is disabled (503)', () => {
      expect(walletRoute).toContain("status: 503")
      expect(walletRoute).not.toContain('postLedgerTransaction')
    })

    it('refund/route.ts uses atomic increment', () => {
      expect(refundRoute).toContain('balance: { increment: refundAmount }')
      expect(refundRoute).not.toMatch(/data:\s*\{\s*balance:\s*newBalance\s*\}/)
    })

    it('admin escrows refund uses atomic increment', () => {
      expect(adminEscrows).toContain('balance: { increment: bigIntToSafeNumber(escrow.totalAmount) }')
      expect(adminEscrows).not.toMatch(/data:\s*\{\s*balance:\s*balanceBefore \+/)
    })

    it('admin escrows refund posts ledger entry', () => {
      expect(adminEscrows).toContain('postLedgerTransaction')
      expect(adminEscrows).toContain('ESCROW_REFUND')
    })

    it('boost/route.ts posts ledger entry for wallet payment', () => {
      const boostRoute = readFile('app/api/properties/[id]/boost/route.ts')
      expect(boostRoute).toContain('postLedgerTransaction')
      expect(boostRoute).toContain('PROPERTY_BOOST')
    })
  })

  describe('All balance reads go through canonical source', () => {
    const jobLifecycle = readFile('lib/domain/job-lifecycle.ts')
    const cronRelease = readFile('app/api/cron/escrow-release/route.ts')
    const cashPayment = readFile('app/api/mobile/v2/jobs/[id]/cash-payment/route.ts')
    const adminEscrows = readFile('app/api/mobile/v2/admin/escrows/route.ts')

    it('job-lifecycle.ts imports readCanonical functions', () => {
      expect(jobLifecycle).toContain("import { readCanonicalProviderBalance, readCanonicalCustomerBalance } from '@/lib/financial-read'")
    })

    it('job-lifecycle.ts fundEscrow reads canonical balance', () => {
      expect(jobLifecycle).toContain('readCanonicalCustomerBalance')
    })

    it('job-lifecycle.ts releaseEscrow reads canonical provider balance', () => {
      expect(jobLifecycle).toContain('readCanonicalProviderBalance')
    })

    it('job-lifecycle.ts refundEscrow reads canonical customer balance', () => {
      expect(jobLifecycle).toContain('readCanonicalCustomerBalance')
    })

    it('cron/escrow-release reads canonical provider balance', () => {
      expect(cronRelease).toContain("import { readCanonicalProviderBalance } from '@/lib/financial-read'")
      expect(cronRelease).toContain('readCanonicalProviderBalance')
    })

    it('cash-payment reads canonical provider balance', () => {
      expect(cashPayment).toContain("import { readCanonicalProviderBalance } from '@/lib/financial-read'")
      expect(cashPayment).toContain('readCanonicalProviderBalance')
    })

    it('admin escrows reads canonical balances', () => {
      expect(adminEscrows).toContain("import { readCanonicalProviderBalance, readCanonicalCustomerBalance } from '@/lib/financial-read'")
      expect(adminEscrows).toContain('readCanonicalProviderBalance')
      expect(adminEscrows).toContain('readCanonicalCustomerBalance')
    })
  })

  describe('Ledger writes WalletBalance atomically', () => {
    const ledger = readFile('lib/ledger.ts')

    it('postLedgerTransaction updates WalletBalance in same transaction', () => {
      expect(ledger).toContain('$executeRawUnsafe')
      expect(ledger).toContain('WalletBalance')
      expect(ledger).toContain('ON CONFLICT')
    })

    it('WalletBalance updates aggregate multiple entries per account', () => {
      expect(ledger).toContain('walletUpdates')
    })

    it('WalletBalance updates handle both CUSTOMER_WALLET and PROVIDER_WALLET', () => {
      expect(ledger).toContain("accountType === 'CUSTOMER_WALLET'")
      expect(ledger).toContain("accountType === 'PROVIDER_WALLET'")
    })
  })

  describe('Fail-closed: no silent error suppression in financial paths', () => {
    const ledger = readFile('lib/ledger.ts')

    it('DEBIT path has no catch block suppressing DB errors', () => {
      const debitIdx = ledger.indexOf('UPDATE "WalletBalance"')
      const debitEndIdx = ledger.indexOf('}', debitIdx)
      const debitSection = ledger.substring(debitIdx, debitEndIdx + 50)
      expect(debitSection).not.toContain('P1000')
      expect(debitSection).not.toContain('does not exist')
      expect(debitSection).not.toMatch(/catch\s*\(e/)
    })

    it('CREDIT path has no catch block suppressing DB errors', () => {
      const creditIdx = ledger.indexOf('INSERT INTO "WalletBalance"')
      const creditEndIdx = ledger.indexOf('}', creditIdx)
      const creditSection = ledger.substring(creditIdx, creditEndIdx + 50)
      expect(creditSection).not.toContain('P1000')
      expect(creditSection).not.toContain('does not exist')
      expect(creditSection).not.toMatch(/catch\s*\(e/)
    })

    it('no broad string matching could hide PostgreSQL errors', () => {
      expect(ledger).not.toMatch(/e\.message\?\.includes\(.*does not exist.*\)/)
      expect(ledger).not.toMatch(/e\.code\s*===\s*'P1000'/)
    })
  })

  describe('No absolute balance sets remain in financial paths', () => {
    const walletRoute = readFile('app/api/mobile/v2/wallet/route.ts')
    const refundRoute = readFile('app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts')
    const adminEscrows = readFile('app/api/mobile/v2/admin/escrows/route.ts')
    const jobLifecycle = readFile('lib/domain/job-lifecycle.ts')
    const cronRelease = readFile('app/api/cron/escrow-release/route.ts')
    const cashPayment = readFile('app/api/mobile/v2/jobs/[id]/cash-payment/route.ts')

    it('no absolute balance set in wallet route', () => {
      expect(walletRoute).not.toMatch(/data:\s*\{\s*balance:\s*newBalance\s*\}/)
      expect(walletRoute).not.toMatch(/data:\s*\{\s*balance:\s*wallet\.balance\s*-\s*amount\s*\}/)
    })

    it('no absolute balance set in refund route', () => {
      expect(refundRoute).not.toMatch(/data:\s*\{\s*balance:\s*newBalance\s*\}/)
    })

    it('no absolute balance set in admin escrows', () => {
      expect(adminEscrows).not.toMatch(/data:\s*\{\s*balance:\s*balanceBefore\s*\+/)
    })

    it('job-lifecycle uses atomic increments for wallet updates', () => {
      expect(jobLifecycle).toContain('balance: { decrement: totalAmountCents }')
      expect(jobLifecycle).toContain('balance: { increment: refundAmount }')
      expect(jobLifecycle).toContain('availableBalance: { increment: netAmount }')
    })

    it('cron release uses atomic increment', () => {
      expect(cronRelease).toContain('availableBalance: { increment: netAmount }')
    })

    it('cash payment uses atomic increment', () => {
      expect(cashPayment).toContain('availableBalance: { increment: netAmount }')
    })
  })

  describe('Float field retirement classification', () => {
    it('all FinancialLedger writes use BigInt', () => {
      const ledger = readFile('lib/ledger.ts')
      expect(ledger).toContain('amount: bigint')
    })

    it('canonical reads return bigint values', () => {
      const financialRead = readFile('lib/financial-read.ts')
      expect(financialRead).toContain('CanonicalWalletBalance')
      expect(financialRead).toContain('balance: bigint')
      expect(financialRead).toContain('availableBalance: bigint')
    })
  })
})
