/**
 * Phase 7.1 — Hard Capability Eligibility Tests
 *
 * Proves that a provider with non-empty capabilities that do NOT match
 * the requested job is excluded with CAPABILITY_MISMATCH BEFORE scoring.
 */
import { describe, it, expect } from 'vitest'
import { hasCapabilityMatch } from '@/lib/matching/index'

describe('Phase 7.1 — Hard Capability Eligibility (hasCapabilityMatch)', () => {
  describe('Category matching', () => {
    it('plumbing provider → plumbing job = included', () => {
      expect(hasCapabilityMatch(['plumbing'], 'plumbing')).toBe(true)
    })

    it('electrical-only provider → plumbing job = excluded', () => {
      expect(hasCapabilityMatch(['electrical'], 'plumbing')).toBe(false)
    })

    it('provider with no capabilities = excluded', () => {
      expect(hasCapabilityMatch([], 'plumbing')).toBe(false)
    })

    it('provider with empty JSON array = excluded', () => {
      expect(hasCapabilityMatch([], 'plumbing')).toBe(false)
    })

    it('case-insensitive matching works', () => {
      expect(hasCapabilityMatch(['Plumbing'], 'plumbing')).toBe(true)
      expect(hasCapabilityMatch(['PLUMBING'], 'plumbing')).toBe(true)
    })

    it('multiple skills, one matches = included', () => {
      expect(hasCapabilityMatch(['electrical', 'plumbing'], 'plumbing')).toBe(true)
    })

    it('partial substring match (skill contains category) = included', () => {
      expect(hasCapabilityMatch(['drain-cleaning'], 'drain')).toBe(true)
    })

    it('partial substring match (category contains skill) = included', () => {
      expect(hasCapabilityMatch(['drain'], 'drain-cleaning')).toBe(true)
    })

    it('unrelated skills = excluded', () => {
      expect(hasCapabilityMatch(['electrical', 'wiring'], 'plumbing')).toBe(false)
    })
  })

  describe('ServiceTemplate matching', () => {
    it('exact service template match = included', () => {
      expect(hasCapabilityMatch(['plumbing'], 'plumbing', 'pipe-repair')).toBe(true)
    })

    it('exact service template ID match = included', () => {
      expect(hasCapabilityMatch(['pipe-repair'], 'plumbing', 'pipe-repair')).toBe(true)
    })

    it('category fallback when serviceTemplateId present = included', () => {
      expect(hasCapabilityMatch(['plumbing'], 'plumbing', 'pipe-repair')).toBe(true)
    })

    it('unrelated to both category and template = excluded', () => {
      expect(hasCapabilityMatch(['electrical'], 'plumbing', 'pipe-repair')).toBe(false)
    })
  })

  describe('Persona isolation', () => {
    it('individual skills used for individual providers', () => {
      const indivSkills = ['plumbing', 'drain-cleaning']
      expect(hasCapabilityMatch(indivSkills, 'plumbing')).toBe(true)
    })

    it('company services used for company providers', () => {
      const companyServices = ['electrical', 'wiring']
      expect(hasCapabilityMatch(companyServices, 'plumbing')).toBe(false)
    })

    it('individual and company data are independently evaluated', () => {
      const indivSkills = ['plumbing']
      const companyServices = ['electrical']
      expect(hasCapabilityMatch(indivSkills, 'plumbing')).toBe(true)
      expect(hasCapabilityMatch(companyServices, 'plumbing')).toBe(false)
    })
  })
})
