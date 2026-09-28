import { describe, it, expect } from 'vitest'
import { getCountryFilter } from '@/lib/admin-rbac'
import type { AdminSession } from '@/lib/admin-types'

function makeSession(overrides: Partial<AdminSession> = {}): AdminSession {
  return {
    id: 'admin-1',
    email: 'test@example.com',
    role: 'MANAGER',
    firstName: 'Test',
    lastName: 'Admin',
    assignedCountries: ['LK'],
    authType: 'adminUser',
    ...overrides,
  }
}

describe('Gate 16 — Admin Country RBAC', () => {
  describe('SUPER_ADMIN bypasses country filter', () => {
    it('SUPER_ADMIN with empty assignedCountries sees all', () => {
      const session = makeSession({ role: 'SUPER_ADMIN', assignedCountries: [] })
      const filter = getCountryFilter(session)
      expect(filter).toEqual({})
    })

    it('SUPER_ADMIN with assigned countries still sees all', () => {
      const session = makeSession({ role: 'SUPER_ADMIN', assignedCountries: ['LK'] })
      const filter = getCountryFilter(session)
      expect(filter).toEqual({})
    })
  })

  describe('LK admin scoped to LK only', () => {
    it('MANAGER with assignedCountries=["LK"] filters by countryCode LK', () => {
      const session = makeSession({ role: 'MANAGER', assignedCountries: ['LK'] })
      const filter = getCountryFilter(session)
      expect(filter).toEqual({ countryCode: { in: ['LK'] } })
    })
  })

  describe('CA admin scoped to CA only', () => {
    it('FINANCE with assignedCountries=["CA"] filters by countryCode CA', () => {
      const session = makeSession({ role: 'FINANCE', assignedCountries: ['CA'] })
      const filter = getCountryFilter(session)
      expect(filter).toEqual({ countryCode: { in: ['CA'] } })
    })
  })

  describe('Multi-country admin', () => {
    it('MANAGER with assignedCountries=["LK","CA"] sees both', () => {
      const session = makeSession({ role: 'MANAGER', assignedCountries: ['LK', 'CA'] })
      const filter = getCountryFilter(session)
      expect(filter).toEqual({ countryCode: { in: ['LK', 'CA'] } })
    })
  })

  describe('Admin with no assigned countries sees nothing', () => {
    it('MANAGER with empty assignedCountries gets exclusion filter', () => {
      const session = makeSession({ role: 'MANAGER', assignedCountries: [] })
      const filter = getCountryFilter(session)
      expect(filter).toEqual({ id: '__NONE__' })
    })
  })

  describe('Cross-country data isolation', () => {
    it('LK admin filter applied to marketplaceJob query excludes CA jobs', () => {
      const session = makeSession({ assignedCountries: ['LK'] })
      const countryFilter = getCountryFilter(session)
      const where = { status: 'OPEN', ...countryFilter }
      expect(where).toEqual({ status: 'OPEN', countryCode: { in: ['LK'] } })
    })

    it('LK admin filter applied to dispute query excludes CA disputes', () => {
      const session = makeSession({ assignedCountries: ['LK'] })
      const countryFilter = getCountryFilter(session)
      const where = { status: 'OPEN', ...countryFilter }
      expect(where).toEqual({ status: 'OPEN', countryCode: { in: ['LK'] } })
    })

    it('LK admin filter applied to KYC query excludes CA identity documents', () => {
      const session = makeSession({ assignedCountries: ['LK'] })
      const countryFilter = getCountryFilter(session)
      const where = { status: 'PENDING', ...countryFilter }
      expect(where).toEqual({ status: 'PENDING', countryCode: { in: ['LK'] } })
    })
  })
})
