import { describe, it, expect, vi } from 'vitest'
import { resolveJobRequirements, hasCapabilityMatch, hasRelationalCapability, hasCompanySpecialtyCapability } from '@/lib/matching'
import type { JobRequirements } from '@/lib/matching'

function mockPrisma(overrides: Record<string, any> = {}) {
  return {
    jobCategory: { findUnique: vi.fn().mockResolvedValue(null) },
    serviceTemplate: { findUnique: vi.fn().mockResolvedValue(null) },
    templateJob: { findUnique: vi.fn().mockResolvedValue(null) },
    ...overrides,
  } as any
}

describe('Phase 10.2 — Canonical Index Integration', () => {
  describe('resolveJobRequirements', () => {
    it('returns null when category not found', async () => {
      const client = mockPrisma()
      const result = await resolveJobRequirements(client, 'nonexistent')
      expect(result).toBeNull()
    })

    it('resolves category slug', async () => {
      const client = mockPrisma({
        jobCategory: {
          findUnique: vi.fn().mockResolvedValue({ id: 'cat-1', slug: 'plumbing' }),
        },
      })
      const result = await resolveJobRequirements(client, 'cat-1')
      expect(result?.categorySlug).toBe('plumbing')
      expect(result?.categoryId).toBe('cat-1')
    })

    it('resolves service template slug', async () => {
      const client = mockPrisma({
        jobCategory: {
          findUnique: vi.fn().mockResolvedValue({ id: 'cat-1', slug: 'plumbing' }),
        },
        serviceTemplate: {
          findUnique: vi.fn().mockResolvedValue({
            slug: 'pipe-repair',
            templateJobId: null,
            jobCategoryId: 'cat-1',
          }),
        },
      })
      const result = await resolveJobRequirements(client, 'cat-1', 'st-1')
      expect(result?.serviceTemplateSlug).toBe('pipe-repair')
    })

    it('resolves template job IDs', async () => {
      const client = mockPrisma({
        jobCategory: {
          findUnique: vi.fn().mockResolvedValue({ id: 'cat-1', slug: 'plumbing' }),
        },
        templateJob: {
          findUnique: vi.fn().mockResolvedValue({ id: 'tj-1', categoryId: 'cat-1' }),
        },
      })
      const result = await resolveJobRequirements(client, 'cat-1', null, 'tj-1')
      expect(result?.templateJobIds).toContain('tj-1')
    })
  })

  describe('hasCapabilityMatch', () => {
    const jobReqs: JobRequirements = {
      categorySlug: 'plumbing',
      categoryId: 'cat-1',
      templateJobIds: [],
      serviceTemplateSlug: 'pipe-repair',
    }

    it('returns true for exact category match', () => {
      expect(hasCapabilityMatch(['plumbing'], jobReqs)).toBe(true)
    })

    it('returns true for exact service template match', () => {
      expect(hasCapabilityMatch(['pipe-repair'], jobReqs)).toBe(true)
    })

    it('returns false for no match', () => {
      expect(hasCapabilityMatch(['painting'], jobReqs)).toBe(false)
    })

    it('returns false for empty skills', () => {
      expect(hasCapabilityMatch([], jobReqs)).toBe(false)
    })

    it('is case-insensitive', () => {
      expect(hasCapabilityMatch(['Plumbing'], jobReqs)).toBe(true)
    })
  })

  describe('hasRelationalCapability', () => {
    const jobReqs: JobRequirements = {
      categorySlug: 'plumbing',
      categoryId: 'cat-1',
      templateJobIds: ['tj-1', 'tj-2'],
      serviceTemplateSlug: null,
    }

    it('returns true when provider has matching template job', () => {
      expect(hasRelationalCapability(['tj-1'], jobReqs)).toBe(true)
    })

    it('returns false when no overlap', () => {
      expect(hasRelationalCapability(['tj-3'], jobReqs)).toBe(false)
    })

    it('returns false for empty arrays', () => {
      expect(hasRelationalCapability([], jobReqs)).toBe(false)
      expect(hasRelationalCapability(['tj-1'], { ...jobReqs, templateJobIds: [] })).toBe(false)
    })
  })

  describe('hasCompanySpecialtyCapability', () => {
    const jobReqs: JobRequirements = {
      categorySlug: 'plumbing',
      categoryId: 'cat-1',
      templateJobIds: ['tj-1'],
      serviceTemplateSlug: null,
    }

    it('returns true for category match', () => {
      expect(hasCompanySpecialtyCapability([{ categoryId: 'cat-1', jobId: null }], jobReqs)).toBe(true)
    })

    it('returns true for job match', () => {
      expect(hasCompanySpecialtyCapability([{ categoryId: null, jobId: 'tj-1' }], jobReqs)).toBe(true)
    })

    it('returns false for no match', () => {
      expect(hasCompanySpecialtyCapability([{ categoryId: 'cat-2', jobId: 'tj-2' }], jobReqs)).toBe(false)
    })
  })
})
