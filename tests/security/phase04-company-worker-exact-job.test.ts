import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkWorkerEligibility } from '@/lib/phase6/provider-eligibility'

const db = vi.hoisted(() => ({
  member: vi.fn(), user: vi.fn(), job: vi.fn(), profile: vi.fn(),
  category: vi.fn(), service: vi.fn(), skill: vi.fn(), conflicts: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    teamMember: { findFirst: db.member },
    user: { findUnique: db.user },
    marketplaceJob: { findUnique: db.job },
    taskerProfile: { findUnique: db.profile },
    jobCategory: { findUnique: db.category },
    serviceTemplate: { findUnique: db.service },
    taskerSkill: { findFirst: db.skill },
    companyJobAssignment: { findMany: db.conflicts },
  },
}))

const validJob = {
  categoryId: 'cat-plumbing',
  serviceTemplateId: 'service-pipe-repair',
  templateJobId: null,
  countryCode: 'LK',
  latitude: null,
  longitude: null,
  preferredDate: null,
  preferredTimeSlot: null,
  workerIdentityCheckRequired: false,
}

describe('Phase 04 — company worker assignment respects exact service selection', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.member.mockResolvedValue({
      id: 'member', companyId: 'company', userId: 'worker',
      status: 'ACTIVE', skills: '[]',
    })
    db.user.mockResolvedValue({
      id: 'worker', identityStatus: 'VERIFIED', isActive: true,
      isSuspended: false, isBanned: false, countryCode: 'LK',
    })
    db.job.mockResolvedValue(validJob)
    db.profile.mockResolvedValue({ id: 'profile', countryCode: 'LK', skills: '[]' })
    db.category.mockResolvedValue({
      id: 'cat-plumbing', name: 'Plumbing', slug: 'plumbing',
    })
    db.service.mockResolvedValue({
      id: 'service-pipe-repair', jobCategoryId: 'cat-plumbing',
      templateJobId: 'job-pipe-repair',
    })
    db.skill.mockResolvedValue({ id: 'tasker-skill' })
    db.conflicts.mockResolvedValue([])
  })

  it('allows the selected exact service and queries by its TemplateJob ID', async () => {
    const result = await checkWorkerEligibility('company', 'worker', 'booking')
    expect(result.eligible).toBe(true)
    expect(db.skill).toHaveBeenCalledWith({
      where: { taskerId: 'profile', jobId: 'job-pipe-repair' },
      select: { id: true },
    })
  })

  it('rejects a worker who selected only a sibling job in the same department', async () => {
    db.skill.mockResolvedValue(null)
    const result = await checkWorkerEligibility('company', 'worker', 'booking')
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('Worker lacks required capability for this job')
    expect(db.skill.mock.calls[0][0].where).not.toHaveProperty('job')
  })

  it('preserves explicitly category-wide legacy membership skills', async () => {
    db.skill.mockResolvedValue(null)
    db.member.mockResolvedValue({ id: 'member', skills: '["plumbing"]' })
    expect((await checkWorkerEligibility('company', 'worker', 'booking')).eligible).toBe(true)
  })

  it('retains category capability for a historical booking without an exact service ID', async () => {
    db.job.mockResolvedValue({ ...validJob, serviceTemplateId: null, templateJobId: null })
    expect((await checkWorkerEligibility('company', 'worker', 'booking')).eligible).toBe(true)
    expect(db.skill).toHaveBeenCalledWith({
      where: { taskerId: 'profile', job: { categoryId: 'cat-plumbing' } },
      select: { id: true },
    })
    expect(db.service).not.toHaveBeenCalled()
  })

  it('blocks tampered service-to-category links despite the worker having the job capability', async () => {
    db.service.mockResolvedValue({
      id: 'service-pipe-repair', jobCategoryId: 'cat-electrical',
      templateJobId: 'job-pipe-repair',
    })
    const result = await checkWorkerEligibility('company', 'worker', 'booking')
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('Job service category does not match its catalogue selection')
  })

  it('blocks a missing linked service template instead of silently falling back', async () => {
    db.service.mockResolvedValue(null)
    const result = await checkWorkerEligibility('company', 'worker', 'booking')
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('Job service category does not match its catalogue selection')
  })

  it('blocks contradictory direct and linked TemplateJob IDs', async () => {
    db.job.mockResolvedValue({ ...validJob, templateJobId: 'other-job' })
    const result = await checkWorkerEligibility('company', 'worker', 'booking')
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('Job service category does not match its catalogue selection')
  })

  it('refuses a qualified worker whose account belongs to a different market', async () => {
    db.user.mockResolvedValue({
      identityStatus: 'VERIFIED', isActive: true, isSuspended: false,
      isBanned: false, countryCode: 'CA',
    })
    db.profile.mockResolvedValue({ id: 'profile', countryCode: 'CA', skills: '[]' })
    const result = await checkWorkerEligibility('company', 'worker', 'booking')
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('Worker market does not match the job market')
  })
})
