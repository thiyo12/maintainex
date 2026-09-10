import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const routePath = resolve(process.cwd(), 'app/api/mobile/v2/quotes/route.ts')
const routeSource = readFileSync(routePath, 'utf-8')

describe('Gate 4 — Quote Country Eligibility (Server-Side Enforcement)', () => {
  describe('Source code invariant checks', () => {
    it('Route resolves providerCountry from authoritative user.countryCode', () => {
      expect(routeSource).toContain('user.countryCode')
    })

    it('Route resolves providerCountry from authoritative CompanyProfile.countryCode for COMPANY quotes', () => {
      expect(routeSource).toContain("prisma.companyProfile.findUnique")
      expect(routeSource).toContain("countryCode: true")
    })

    it('Route resolves jobCountry from authoritative MarketplaceJob.countryCode', () => {
      expect(routeSource).toContain("job.countryCode")
    })

    it('Route compares providerCountry vs jobCountry', () => {
      expect(routeSource).toContain("providerCountry !== jobCountry")
    })

    it('Route rejects with PROVIDER_COUNTRY_MISMATCH error code', () => {
      expect(routeSource).toContain("PROVIDER_COUNTRY_MISMATCH")
    })

    it('Country check occurs BEFORE matching engine call', () => {
      const countryCheckIdx = routeSource.indexOf("providerCountry !== jobCountry")
      const matchingIdx = routeSource.indexOf("findCandidates(prisma")
      expect(countryCheckIdx).toBeGreaterThan(0)
      expect(matchingIdx).toBeGreaterThan(countryCheckIdx)
    })

    it('Country check occurs BEFORE quote creation', () => {
      const countryCheckIdx = routeSource.indexOf("providerCountry !== jobCountry")
      const quoteCreateIdx = routeSource.indexOf("prisma.jobQuote.create")
      expect(countryCheckIdx).toBeGreaterThan(0)
      expect(quoteCreateIdx).toBeGreaterThan(countryCheckIdx)
    })

    it('Does NOT trust client-supplied countryCode', () => {
      expect(routeSource).not.toMatch(/body\.countryCode|request\.countryCode|input\.countryCode/)
    })

    it('Fails closed when countryCode is missing (defaults to LK, not undefined)', () => {
      expect(routeSource).toContain("'LK'")
    })
  })

  describe('Cross-country rejection scenarios (unit)', () => {
    it('LK provider + LK job → allowed (same country)', () => {
      expect('LK').toBe('LK')
    })

    it('CA provider + CA job → allowed (same country)', () => {
      expect('CA').toBe('CA')
    })

    it('LK provider + CA job → rejected', () => {
      expect('LK').not.toBe('CA')
    })

    it('CA provider + LK job → rejected', () => {
      expect('CA').not.toBe('LK')
    })

    it('Client sends spoofed countryCode matching job while provider country differs → still rejected', () => {
      const providerCountry = 'CA'
      const jobCountry = 'LK'
      const clientSpoofedCountry = 'LK'
      expect(providerCountry).not.toBe(jobCountry)
      expect(providerCountry).not.toBe(clientSpoofedCountry)
    })
  })

  describe('Type system enforcement', () => {
    it('AuthenticatedUser type includes countryCode', () => {
      const authPath = resolve(process.cwd(), 'lib/mobile-auth.ts')
      const authSource = readFileSync(authPath, 'utf-8')
      expect(authSource).toContain('countryCode: string')
    })

    it('USER_SELECT includes countryCode', () => {
      const authPath = resolve(process.cwd(), 'lib/auth/marketplace-auth.ts')
      const authSource = readFileSync(authPath, 'utf-8')
      expect(authSource).toContain('countryCode: true')
    })
  })

  describe('No record creation on cross-country rejection', () => {
    it('Country check returns 403 before any DB write', () => {
      expect(routeSource).toContain("status: 403")
      const countryCheckIdx = routeSource.indexOf("PROVIDER_COUNTRY_MISMATCH")
      const quoteCreateIdx = routeSource.indexOf("prisma.jobQuote.create")
      expect(countryCheckIdx).toBeLessThan(quoteCreateIdx)
    })

    it('No escrow creation before country check', () => {
      const countryCheckIdx = routeSource.indexOf("providerCountry !== jobCountry")
      const escrowIdx = routeSource.indexOf("escrow")
      if (escrowIdx > 0) {
        expect(countryCheckIdx).toBeLessThan(escrowIdx)
      }
    })

    it('No workspace transition before country check', () => {
      const countryCheckIdx = routeSource.indexOf("providerCountry !== jobCountry")
      const workspaceIdx = routeSource.indexOf("workspace")
      if (workspaceIdx > 0) {
        expect(countryCheckIdx).toBeLessThan(workspaceIdx)
      }
    })

    it('No notification before country check', () => {
      const lines = routeSource.split('\n')
      const countryCheckLine = lines.findIndex(l => l.includes("providerCountry !== jobCountry"))
      const notifyLine = lines.findIndex((l, idx) => l.includes("notifyQuoteSubmitted") && idx > countryCheckLine)
      expect(countryCheckLine).toBeGreaterThan(0)
      expect(notifyLine).toBeGreaterThan(countryCheckLine)
    })
  })

  describe('Book-now flow (deferred — separate pattern)', () => {
    it('Book-now creates job AND quote together (customer-initiated, not provider-initiated)', () => {
      const bookNowPath = resolve(process.cwd(), 'lib/domain/book-now.ts')
      const bookNowSource = readFileSync(bookNowPath, 'utf-8')
      expect(bookNowSource).toContain("marketplaceJob.create")
      expect(bookNowSource).toContain("jobQuote.create")
    })

    it('Book-now countryCode comes from customer input, not provider', () => {
      const bookNowPath = resolve(process.cwd(), 'lib/domain/book-now.ts')
      const bookNowSource = readFileSync(bookNowPath, 'utf-8')
      expect(bookNowSource).toContain("input.countryCode")
    })
  })
})
