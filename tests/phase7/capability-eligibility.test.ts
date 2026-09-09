/**
 * Phase 7.2 — Canonical Capability Eligibility Tests
 *
 * Uses realistic database identifiers (CUIDs for IDs, slugs for capabilities).
 * Proves that providers are matched against resolved category slugs, not raw CUIDs.
 */
import { describe, it, expect } from 'vitest'
import {
  hasCapabilityMatch,
  hasRelationalCapability,
  hasCompanySpecialtyCapability,
  JobRequirements,
} from '@/lib/matching/index'

const plumbingSlug = 'plumbing'
const electricalSlug = 'electrical'
const plumbingCategoryId = 'cm1a2b3c4d5e6f7g8h9i0j'
const electricalCategoryId = 'cm9z8y7x6w5v4u3t2s1r0q'
const pipeRepairTemplateId = 'cm_repair_template_001'
const drainCleanTemplateJobId = 'cm_drain_clean_job_001'
const unrelatedTemplateJobId = 'cm_unrelated_job_001'

function makeJobReqs(overrides: Partial<JobRequirements> = {}): JobRequirements {
  return {
    categorySlug: plumbingSlug,
    categoryId: plumbingCategoryId,
    templateJobIds: [],
    serviceTemplateSlug: null,
    ...overrides,
  }
}

describe('Phase 7.2 — Canonical Capability Eligibility', () => {
  describe('hasCapabilityMatch — legacy slug matching', () => {
    it('plumbing provider → plumbing job = included', () => {
      expect(hasCapabilityMatch(['plumbing'], makeJobReqs())).toBe(true)
    })

    it('electrical-only provider → plumbing job = excluded (CAPABILITY_MISMATCH)', () => {
      expect(hasCapabilityMatch(['electrical'], makeJobReqs())).toBe(false)
    })

    it('empty capabilities → excluded', () => {
      expect(hasCapabilityMatch([], makeJobReqs())).toBe(false)
    })

    it('CUID must NOT be treated as a category slug', () => {
      const reqs = makeJobReqs({ categorySlug: plumbingSlug })
      expect(hasCapabilityMatch([plumbingCategoryId], reqs)).toBe(false)
    })

    it('case-insensitive slug matching works', () => {
      expect(hasCapabilityMatch(['Plumbing'], makeJobReqs())).toBe(true)
      expect(hasCapabilityMatch(['PLUMBING'], makeJobReqs())).toBe(true)
    })

    it('multiple skills, one matches = included', () => {
      expect(hasCapabilityMatch(['electrical', 'plumbing'], makeJobReqs())).toBe(true)
    })

    it('unrelated skills = excluded', () => {
      expect(hasCapabilityMatch(['electrical', 'wiring'], makeJobReqs())).toBe(false)
    })

    it('substring collision does NOT grant eligibility', () => {
      expect(hasCapabilityMatch(['plumb'], makeJobReqs())).toBe(false)
      expect(hasCapabilityMatch(['umbing'], makeJobReqs())).toBe(false)
    })

    it('exact slug match only, no partial', () => {
      expect(hasCapabilityMatch(['plumbingx'], makeJobReqs())).toBe(false)
      expect(hasCapabilityMatch(['xplumbing'], makeJobReqs())).toBe(false)
    })
  })

  describe('hasCapabilityMatch — ServiceTemplate slug', () => {
    it('exact service template slug match = included', () => {
      const reqs = makeJobReqs({ serviceTemplateSlug: 'pipe-repair' })
      expect(hasCapabilityMatch(['pipe-repair'], reqs)).toBe(true)
    })

    it('category fallback when serviceTemplate present = included', () => {
      const reqs = makeJobReqs({ serviceTemplateSlug: 'pipe-repair' })
      expect(hasCapabilityMatch(['plumbing'], reqs)).toBe(true)
    })

    it('unrelated to both template slug and category slug = excluded', () => {
      const reqs = makeJobReqs({ serviceTemplateSlug: 'pipe-repair' })
      expect(hasCapabilityMatch(['electrical'], reqs)).toBe(false)
    })

    it('service template slug does NOT match CUID', () => {
      const reqs = makeJobReqs({ serviceTemplateSlug: 'pipe-repair' })
      expect(hasCapabilityMatch([pipeRepairTemplateId], reqs)).toBe(false)
    })
  })

  describe('hasRelationalCapability — TaskerSkill', () => {
    it('TaskerSkill with matching templateJobId = included', () => {
      const reqs = makeJobReqs({ templateJobIds: [drainCleanTemplateJobId] })
      expect(hasRelationalCapability([drainCleanTemplateJobId], reqs)).toBe(true)
    })

    it('TaskerSkill with unrelated templateJobId = excluded', () => {
      const reqs = makeJobReqs({ templateJobIds: [drainCleanTemplateJobId] })
      expect(hasRelationalCapability([unrelatedTemplateJobId], reqs)).toBe(false)
    })

    it('empty TaskerSkill list = excluded', () => {
      const reqs = makeJobReqs({ templateJobIds: [drainCleanTemplateJobId] })
      expect(hasRelationalCapability([], reqs)).toBe(false)
    })

    it('no templateJobIds on job = excluded (no relational match possible)', () => {
      const reqs = makeJobReqs({ templateJobIds: [] })
      expect(hasRelationalCapability([drainCleanTemplateJobId], reqs)).toBe(false)
    })

    it('multiple TaskerSkills, one matches = included', () => {
      const reqs = makeJobReqs({ templateJobIds: [drainCleanTemplateJobId] })
      expect(hasRelationalCapability([unrelatedTemplateJobId, drainCleanTemplateJobId], reqs)).toBe(true)
    })
  })

  describe('hasCompanySpecialtyCapability', () => {
    it('CompanySpecialty with matching categoryId = included', () => {
      const reqs = makeJobReqs({ categoryId: plumbingCategoryId })
      expect(hasCompanySpecialtyCapability(
        [{ categoryId: plumbingCategoryId, jobId: null }],
        reqs,
      )).toBe(true)
    })

    it('CompanySpecialty with matching jobId = included', () => {
      const reqs = makeJobReqs({ templateJobIds: [drainCleanTemplateJobId] })
      expect(hasCompanySpecialtyCapability(
        [{ categoryId: null, jobId: drainCleanTemplateJobId }],
        reqs,
      )).toBe(true)
    })

    it('CompanySpecialty with unrelated categoryId = excluded', () => {
      const reqs = makeJobReqs({ categoryId: plumbingCategoryId })
      expect(hasCompanySpecialtyCapability(
        [{ categoryId: electricalCategoryId, jobId: null }],
        reqs,
      )).toBe(false)
    })

    it('CompanySpecialty with unrelated jobId = excluded', () => {
      const reqs = makeJobReqs({ templateJobIds: [drainCleanTemplateJobId] })
      expect(hasCompanySpecialtyCapability(
        [{ categoryId: null, jobId: unrelatedTemplateJobId }],
        reqs,
      )).toBe(false)
    })

    it('empty specialties = excluded', () => {
      const reqs = makeJobReqs()
      expect(hasCompanySpecialtyCapability([], reqs)).toBe(false)
    })

    it('CompanySpecialty categoryId match takes priority over null jobId', () => {
      const reqs = makeJobReqs({ categoryId: plumbingCategoryId, templateJobIds: [drainCleanTemplateJobId] })
      expect(hasCompanySpecialtyCapability(
        [{ categoryId: plumbingCategoryId, jobId: null }],
        reqs,
      )).toBe(true)
    })
  })

  describe('Persona isolation', () => {
    it('individual skills are used only for individual providers', () => {
      const reqs = makeJobReqs()
      expect(hasCapabilityMatch(['plumbing'], reqs)).toBe(true)
    })

    it('company services are used only for company providers', () => {
      const reqs = makeJobReqs({ categoryId: electricalCategoryId, categorySlug: electricalSlug })
      expect(hasCapabilityMatch(['plumbing'], reqs)).toBe(false)
      expect(hasCapabilityMatch(['electrical'], reqs)).toBe(true)
    })

    it('TaskerSkill relational match does NOT authorize company', () => {
      const reqs = makeJobReqs({ templateJobIds: [drainCleanTemplateJobId] })
      const companySpecialties: Array<{ categoryId: string | null; jobId: string | null }> = []
      expect(hasCompanySpecialtyCapability(companySpecialties, reqs)).toBe(false)
    })

    it('CompanySpecialty match does NOT authorize individual', () => {
      const reqs = makeJobReqs({ categoryId: plumbingCategoryId })
      const taskerJobIds: string[] = []
      expect(hasRelationalCapability(taskerJobIds, reqs)).toBe(false)
    })
  })

  describe('ID/slug namespace safety', () => {
    it('CUID-like string is never treated as slug', () => {
      const cuid = 'cm_a1b2c3d4e5f6g7h8i9j0k'
      const reqs = makeJobReqs({ categorySlug: plumbingSlug })
      expect(hasCapabilityMatch([cuid], reqs)).toBe(false)
    })

    it('slug is never treated as CUID for relational matching', () => {
      const reqs = makeJobReqs({ templateJobIds: [drainCleanTemplateJobId] })
      expect(hasRelationalCapability([plumbingSlug], reqs)).toBe(false)
    })

    it('ServiceTemplate CUID is not compared as slug', () => {
      const reqs = makeJobReqs({ serviceTemplateSlug: 'pipe-repair' })
      expect(hasCapabilityMatch([pipeRepairTemplateId], reqs)).toBe(false)
    })
  })
})
