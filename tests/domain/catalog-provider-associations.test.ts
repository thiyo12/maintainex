import { describe, expect, it, vi } from 'vitest'

import {
  collectProviderAssociations,
} from '@/lib/domain/catalog-inventory'

/**
 * Phase 01 exit gate: prove catalogue changes never strand providers or lose
 * provider links. These are read-only aggregate checks with no personal data.
 */
function fakeDb(overrides: {
  jobs?: any[]
  categories?: any[]
  skills?: any[]
  taskerCount?: number
} = {}) {
  return {
    templateJob: { findMany: vi.fn().mockResolvedValue(overrides.jobs ?? []) },
    jobCategory: { findMany: vi.fn().mockResolvedValue(overrides.categories ?? []) },
    taskerSkill: { findMany: vi.fn().mockResolvedValue(overrides.skills ?? []) },
    taskerProfile: { count: vi.fn().mockResolvedValue(overrides.taskerCount ?? 0) },
  } as any
}

const category = (id: string, isActive = true) => ({ id, isActive })

describe('provider association inventory', () => {
  it('counts provider links per job without exposing personal data', async () => {
    const db = fakeDb({
      jobs: [
        { id: 'j1', categoryId: 'c1', isActive: true, countries: '["LK"]', _count: { taskerSkills: 2 } },
        { id: 'j2', categoryId: 'c1', isActive: true, countries: '["LK"]', _count: { taskerSkills: 0 } },
      ],
      categories: [category('c1')],
      skills: [
        { id: 's1', jobId: 'j1', taskerId: 't1', currency: 'LKR' },
        { id: 's2', jobId: 'j1', taskerId: 't2', currency: 'LKR' },
      ],
      taskerCount: 2,
    })

    const result = await collectProviderAssociations(db)

    expect(result.providerSkillLinks).toBe(2)
    expect(result.jobsWithProviders).toBe(1)
    expect(result.jobsWithNoProviders).toBe(1)
    expect(result.taskersWithCatalogueSkills).toBe(2)
    expect(result.taskersWithoutCatalogueSkills).toBe(0)
    expect(result.orphanedProviderLinks).toBe(0)
    expect(result.topUnstaffedJobs).toEqual([{ id: 'j2', providerLinks: 0 }])
  })

  it('flags provider links pointing at a job that no longer exists', async () => {
    const db = fakeDb({
      jobs: [{ id: 'j1', categoryId: 'c1', isActive: true, countries: '["LK"]', _count: { taskerSkills: 0 } }],
      categories: [category('c1')],
      skills: [{ id: 's1', jobId: 'deleted-job', taskerId: 't1', currency: 'LKR' }],
      taskerCount: 1,
    })

    const result = await collectProviderAssociations(db)
    expect(result.orphanedProviderLinks).toBe(1)
  })

  it('flags links stranded by an inactive department or inactive job', async () => {
    const db = fakeDb({
      jobs: [
        { id: 'j1', categoryId: 'c1', isActive: true, countries: '["LK"]', _count: { taskerSkills: 0 } },
        { id: 'j2', categoryId: 'c2', isActive: false, countries: '["LK"]', _count: { taskerSkills: 0 } },
      ],
      categories: [category('c1'), category('c2', false)],
      skills: [
        { id: 's1', jobId: 'j1', taskerId: 't1', currency: 'LKR' },
        { id: 's2', jobId: 'j2', taskerId: 't2', currency: 'LKR' },
      ],
      taskerCount: 2,
    })

    const result = await collectProviderAssociations(db)
    expect(result.providerLinksInInactiveDepartments).toBe(1)
    expect(result.providerLinksOnInactiveJobs).toBe(1)
  })

  it('flags provider rates priced in the wrong currency for the market', async () => {
    const db = fakeDb({
      jobs: [
        { id: 'lk', categoryId: 'c1', isActive: true, countries: '["LK"]', _count: { taskerSkills: 0 } },
        { id: 'ca', categoryId: 'c1', isActive: true, countries: '["CA"]', _count: { taskerSkills: 0 } },
      ],
      categories: [category('c1')],
      skills: [
        { id: 's1', jobId: 'lk', taskerId: 't1', currency: 'CAD' },
        { id: 's2', jobId: 'ca', taskerId: 't2', currency: 'CAD' },
      ],
      taskerCount: 2,
    })

    const result = await collectProviderAssociations(db)
    expect(result.providerLinksWithWrongCurrency).toBe(1)
  })

  it('reports providers with no catalogue skill without naming them', async () => {
    const db = fakeDb({
      jobs: [],
      categories: [],
      skills: [],
      taskerCount: 7,
    })

    const result = await collectProviderAssociations(db)
    expect(result.taskers).toBe(7)
    expect(result.taskersWithoutCatalogueSkills).toBe(7)
    expect(Object.keys(result)).not.toContain('taskerIds')
  })

  it('performs no database mutation', async () => {
    const db = fakeDb({
      jobs: [{ id: 'j1', categoryId: 'c1', isActive: true, countries: '["LK"]', _count: { taskerSkills: 1 } }],
      categories: [category('c1')],
      skills: [{ id: 's1', jobId: 'j1', taskerId: 't1', currency: 'LKR' }],
      taskerCount: 1,
    })
    await collectProviderAssociations(db)
    for (const key of ['create', 'update', 'delete', 'upsert'] as const) {
      expect((db as any)[key]).toBeUndefined()
    }
  })
})
