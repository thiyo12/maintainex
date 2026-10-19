import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkWorkerEligibility } from '@/lib/phase6/provider-eligibility'

const db = vi.hoisted(() => ({
  member: vi.fn(), user: vi.fn(), job: vi.fn(), profile: vi.fn(),
  category: vi.fn(), service: vi.fn(), skill: vi.fn(), conflicts: vi.fn(), busy: vi.fn(),
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
    companyJobAssignment: { findMany: db.conflicts, findFirst: db.busy },
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
      status: 'ACTIVE', role: 'WORKER', skills: '[]',
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
    db.busy.mockResolvedValue(null)
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

  it('does not turn a derived tasker-profile category into every sibling service', async () => {
    db.skill.mockResolvedValue(null) // relational selection belongs to another TemplateJob
    db.profile.mockResolvedValue({
      id: 'profile', countryCode: 'LK', skills: '["plumbing","cat-plumbing"]',
    })
    const result = await checkWorkerEligibility('company', 'worker', 'booking')
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('Worker lacks required capability for this job')
  })

  it('honors an exact job token on the profile without widening its category', async () => {
    db.skill.mockResolvedValue(null)
    db.profile.mockResolvedValue({
      id: 'profile', countryCode: 'LK',
      skills: '["cat-plumbing","job-pipe-repair"]',
    })
    expect((await checkWorkerEligibility('company', 'worker', 'booking')).eligible).toBe(true)
  })

  it('keeps historical category-only bookings compatible with profile category skills', async () => {
    db.skill.mockResolvedValue(null)
    db.job.mockResolvedValue({
      ...validJob, serviceTemplateId: null, templateJobId: null,
    })
    db.profile.mockResolvedValue({
      id: 'profile', countryCode: 'LK', skills: '["plumbing"]',
    })
    expect((await checkWorkerEligibility('company', 'worker', 'booking')).eligible).toBe(true)
  })

  it('preserves explicitly category-wide legacy membership skills', async () => {
    db.skill.mockResolvedValue(null)
    db.member.mockResolvedValue({ id: 'member', role: 'WORKER', skills: '["plumbing"]' })
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

  it('refuses a finance-only company member even with exact job skills', async () => {
    db.member.mockResolvedValue({ id: 'member', role: 'FINANCE', skills: '["plumbing"]' })
    const result = await checkWorkerEligibility('company', 'worker', 'booking')
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('Company member does not hold the worker role')
  })

  it('does not dispatch a single worker to a booking that requires a crew', async () => {
    db.job.mockResolvedValue({ ...validJob, workersCount: 3 })
    const result = await checkWorkerEligibility('company', 'worker', 'booking')
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('Job requires a multi-worker crew; one worker is insufficient')
  })

  it('blocks undated dispatch when the worker already has an active assignment', async () => {
    db.busy.mockResolvedValue({ id: 'existing' })
    // Another assignment blocks capacity even when neither job has a date.
    const result = await checkWorkerEligibility('company', 'worker', 'booking')
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('Worker has an active assignment and no date to prove capacity')
    expect(db.busy).toHaveBeenCalledWith({
      where: {
        workerUserId: 'worker',
        status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
        jobId: { not: 'booking' },
      },
      select: { id: true },
    })
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
