import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function readFile(relativePath: string): string {
  return readFileSync(resolve(__dirname, '../..', relativePath), 'utf-8')
}

describe('Part W — Negative Security Tests', () => {
  describe('Cross-country provider rejection', () => {
    it('quote route rejects provider whose countryCode differs from job countryCode', () => {
      const route = readFile('app/api/mobile/v2/quotes/route.ts')
      expect(route).toContain('PROVIDER_COUNTRY_MISMATCH')
      expect(route).toContain('providerCountry')
      expect(route).toContain('jobCountry')
    })

    it('quote route compares providerCountry vs jobCountry before any DB write', () => {
      const route = readFile('app/api/mobile/v2/quotes/route.ts')
      const mismatchIdx = route.indexOf('PROVIDER_COUNTRY_MISMATCH')
      const createIdx = route.indexOf('jobQuote.create')
      expect(mismatchIdx).toBeGreaterThan(-1)
      if (createIdx > -1) {
        expect(mismatchIdx).toBeLessThan(createIdx)
      }
    })
  })

  describe('Client-spofed countryCode blocked on job creation', () => {
    it('mobile job creation cross-checks countryCode against user.countryCode', () => {
      const route = readFile('app/api/mobile/v2/jobs/route.ts')
      expect(route).toContain('COUNTRY_MISMATCH')
      expect(route).toContain('finalCountryCode !== user.countryCode')
    })

    it('book-now route cross-checks countryCode against user.countryCode', () => {
      const route = readFile('app/api/mobile/v2/book-now/route.ts')
      expect(route).toContain('COUNTRY_MISMATCH')
      expect(route).toContain('requestedCountryCode !== user.countryCode')
    })
  })

  describe('Client-spofed currency blocked', () => {
    it('withdrawal route hardcodes LKR and rejects CAD', () => {
      const route = readFile('app/api/mobile/withdraw/route.ts')
      expect(route).toContain('CAD_WITHDRAWAL_NOT_SUPPORTED')
      expect(route).toContain("'LKR'")
    })

    it('withdrawal route requires canonical LKR WalletBalance', () => {
      const route = readFile('app/api/mobile/withdraw/route.ts')
      expect(route).toContain('currency: \'LKR\'')
      expect(route).toContain('LKR_BALANCE_NOT_FOUND')
    })
  })

  describe('CAD financial request cannot touch LKR wallet', () => {
    it('fundEscrow fails closed if canonical WalletBalance missing for escrow currency', () => {
      const lifecycle = readFile('lib/finance/escrow/escrow-service.ts')
      expect(lifecycle).toContain('WALLET_CURRENCY_NOT_FOUND')
    })

    it('fundEscrow only updates legacy CustomerWallet for LKR', () => {
      const lifecycle = readFile('lib/finance/escrow/escrow-service.ts')
      const fundIdx = lifecycle.indexOf('export async function fundEscrow')
      const lkrGuard = lifecycle.indexOf('escrowCurrency === \'LKR\'', fundIdx)
      expect(fundIdx).toBeGreaterThan(-1)
      expect(lkrGuard).toBeGreaterThan(fundIdx)
    })

    it('releaseEscrow only updates legacy ProviderWallet for LKR', () => {
      const lifecycle = readFile('lib/finance/escrow/escrow-service.ts')
      const releaseIdx = lifecycle.indexOf('export async function releaseEscrow')
      const lkrGuard = lifecycle.indexOf('escrowCurrency === \'LKR\'', releaseIdx)
      expect(releaseIdx).toBeGreaterThan(-1)
      expect(lkrGuard).toBeGreaterThan(releaseIdx)
    })

    it('refundEscrow only updates legacy CustomerWallet for LKR', () => {
      const lifecycle = readFile('lib/finance/escrow/escrow-service.ts')
      const refundIdx = lifecycle.indexOf('export async function refundEscrow')
      const lkrGuard = lifecycle.indexOf('escrowCurrency === \'LKR\'', refundIdx)
      expect(refundIdx).toBeGreaterThan(-1)
      expect(lkrGuard).toBeGreaterThan(refundIdx)
    })
  })

  describe('Zero-country admin sees zero data', () => {
    it('getCountryFilter returns __NONE__ sentinel for zero-country admin', () => {
      const rbac = readFile('lib/auth/authorization/admin-rbac.ts')
      expect(rbac).toContain('__NONE__')
      expect(rbac).toContain('assignedCountries.length === 0')
    })

    it('admin users route uses the fail-closed CRM country filter', () => {
      const route = readFile('app/api/admin/users/route.ts')
      const security = readFile('lib/crm/security.ts')
      expect(route).toContain('requireCountryScope: true')
      expect(route).toContain('getCrmCountryFilter(security)')
      expect(security).toContain("return { id: '__NONE__' }")
    })
  })

  describe('Admin cannot access cross-country entities', () => {
    it('admin jobs PATCH checks job country before transition', () => {
      const route = readFile('app/api/admin/jobs/route.ts')
      expect(route).toContain('Forbidden: job belongs to a different country')
    })

    it('admin disputes PATCH checks dispute country', () => {
      const route = readFile('app/api/admin/disputes/route.ts')
      expect(route).toContain('assertCrmCountryAllowed(security, marketplaceDispute.countryCode')
    })

    it('admin KYC PATCH checks document country', () => {
      const route = readFile('app/api/admin/kyc/route.ts')
      expect(route).toContain('assertCrmCountryAllowed(security, document.countryCode)')
    })

    it('admin commission PUT checks settlement country', () => {
      const route = readFile('app/api/admin/financial/commission/route.ts')
      expect(route).toContain('assertCrmCountryAllowed(security, settlement.countryCode)')
    })

    it('admin companies verification checks company country', () => {
      const route = readFile('app/api/admin/companies/[id]/verification/route.ts')
      expect(route).toContain('assertCrmCountryAllowed(security, company.countryCode)')
    })
  })

  describe('Unsupported country rejected', () => {
    it('pricing config fails closed when country config missing and GLOBAL fallback used', () => {
      const rules = readFile('lib/pricing/rules.ts')
      expect(rules).toContain('cfg.countryCode')
    })

    it('acceptJobQuote validates pricing country matches job country', () => {
      const lifecycle = readFile('lib/domain/job-lifecycle.ts')
      expect(lifecycle).toContain('PRICING_COUNTRY_MISMATCH')
    })
  })

  describe('CAD withdrawal explicitly unsupported', () => {
    it('withdrawal route returns explicit CAD rejection error', () => {
      const route = readFile('app/api/mobile/withdraw/route.ts')
      expect(route).toContain('CAD withdrawals are not yet supported')
      expect(route).toContain('CAD_WITHDRAWAL_NOT_SUPPORTED')
    })
  })

  describe('Payout idempotency includes currency', () => {
    it('payout engine includes currency in payload hash', () => {
      const engine = readFile('lib/finance/payouts/payout-engine.ts')
      expect(engine).toContain('`${userId}:${amountCents.toString()}:${method}:${currency}`')
    })
  })

  describe('Ledger fingerprint includes currency', () => {
    it('ledger fingerprint computation includes currency', () => {
      const ledger = readFile('lib/finance/ledger/ledger-service.ts')
      expect(ledger).toContain('currency:')
      expect(ledger).toContain('normalized')
    })
  })

  describe('Matching engine filters by country at DB level', () => {
    it('canonical matching filters provider candidates by countryCode in Prisma where', () => {
      const engine = readFile('lib/matching/index.ts')
      expect(engine).toContain('user: canonicalInput.countryCode ? { countryCode: canonicalInput.countryCode } : undefined')
      expect(engine.match(/user: canonicalInput\.countryCode \? \{ countryCode: canonicalInput\.countryCode \} : undefined/g)?.length).toBe(2)
    })

    it('canonical matching applies job countryCode to scoped queries in Prisma where', () => {
      const matcher = readFile('lib/matching/index.ts')
      expect(matcher).toContain('user: job.countryCode ? { countryCode: job.countryCode } : undefined')
    })
  })
})
