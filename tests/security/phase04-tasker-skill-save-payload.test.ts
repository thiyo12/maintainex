import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mock = vi.hoisted(() => ({
  account: 'CA',
  suspended: false, transaction: vi.fn(),
  tasker: vi.fn(), taskerUpdate: vi.fn(),
  jobs: vi.fn(), categoryJobs: vi.fn(), legacyCategories: vi.fn(),
  selections: vi.fn(), deleteSkills: vi.fn(), saveSkill: vi.fn(),
}))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  authenticateRequest: async () => ({
    id: 'provider', role: 'TASKER', countryCode: mock.account,
  }),
  assertNotSuspended: () => mock.suspended
    ? NextResponse.json({ error: 'Suspended' }, { status: 403 }) : null,
}))
vi.mock('@/lib/prisma', () => ({ prisma: {
  $transaction: mock.transaction,
  taskerProfile: { upsert: mock.tasker, update: mock.taskerUpdate },
  templateJob: { findMany: mock.jobs },
  jobCategory: { findMany: mock.categoryJobs },
  category: { findMany: mock.legacyCategories },
  taskerSkill: { findMany: mock.selections, deleteMany: mock.deleteSkills, upsert: mock.saveSkill },
} }))
async function put(body?: unknown, raw?: string) {
  const { PUT } = await import('@/app/api/mobile/taskers/skills/route')
  const response = await PUT(new NextRequest('http://localhost/api/mobile/taskers/skills', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: raw ?? JSON.stringify(body),
  }))
  return { response, body: await response.json() }
}
const job = {
  id: 'local-service', categoryId: 'plumbing', isActive: true,
  isCompanyOnly: false, countries: '["CA"]', currency: 'CAD',
  category: { isActive: true, countries: '["CA"]' },
}
describe('Phase 04 — service selection PUT preserves data on invalid payloads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.account = 'CA'
    mock.suspended = false
    mock.tasker.mockResolvedValue({ id: 'tasker-1' })
    mock.taskerUpdate.mockResolvedValue({ id: 'tasker-1' })
    // Prisma's id: { in: [] } returns no rows; preserve that behavior
    // so explicit empty selection remains a valid clear operation.
    mock.jobs.mockImplementation(async ({ where }) =>
      where.id.in.includes(job.id) ? [job] : [])
    mock.categoryJobs.mockResolvedValue([{ id: 'plumbing', name: 'Plumbing', slug: 'plumbing' }])
    mock.legacyCategories.mockResolvedValue([])
    mock.selections.mockResolvedValue([])
    mock.saveSkill.mockResolvedValue({ id: 'saved' })
    mock.transaction.mockImplementation(async fn => fn({
      taskerProfile: { update: mock.taskerUpdate },
      taskerSkill: {
        findMany: mock.selections,
        deleteMany: mock.deleteSkills,
        upsert: mock.saveSkill,
      },
      jobCategory: { findMany: mock.categoryJobs },
      category: { findMany: mock.legacyCategories },
    }))
  })
  async function noMutation() {
    expect(mock.tasker).not.toHaveBeenCalled()
    expect(mock.deleteSkills).not.toHaveBeenCalled()
    expect(mock.saveSkill).not.toHaveBeenCalled()
    expect(mock.taskerUpdate).not.toHaveBeenCalled()
    expect(mock.transaction).not.toHaveBeenCalled()
  }
  it.each([
    ['missing skills', {}],
    ['null skills', { skills: null }],
    ['string skills', { skills: 'local-service' }],
    ['object skills', { skills: { jobId: 'local-service' } }],
    ['number skills', { skills: 5 }],
    ['array at root', []],
  ])('rejects %s without erasing existing capabilities', async (_name, payload) => {
    const result = await put(payload)
    expect(result.response.status).toBe(400)
    expect(result.body.code).toBe('INVALID_SKILL_SELECTION')
    await noMutation()
  })
  it('rejects malformed JSON before any profile write or delete', async () => {
    const result = await put(undefined, '{broken json')
    expect(result.response.status).toBe(400)
    expect(result.body.code).toBe('INVALID_SKILL_SELECTION')
    await noMutation()
  })
  it('rejects repeated and whitespace-equivalent IDs without partial updates', async () => {
    const result = await put({ skills: [
      { jobId: 'local-service' }, { jobId: ' local-service ' },
    ] })
    expect(result.response.status).toBe(400)
    expect(result.body.code).toBe('DUPLICATE_SERVICE')
    await noMutation()
  })
  it('rejects invalid service records without creating a provider profile', async () => {
    const result = await put({ skills: [{ jobId: '' }] })
    expect(result.response.status).toBe(400)
    await noMutation()
  })
  it('allows an explicit empty array as the intended clear-selection action', async () => {
    const result = await put({ skills: [] })
    expect(result.response.status).toBe(200)
    expect(result.body).toEqual({ saved: 0 })
    expect(mock.taskerUpdate).toHaveBeenCalledWith({
      where: { id: 'tasker-1' }, data: { skills: '[]' },
    })
  })
  it('saves valid Canadian selections and persists market and currency', async () => {
    const result = await put({ skills: [{ jobId: 'local-service', hourlyRate: 80 }] })
    expect(result.response.status).toBe(200)
    expect(result.body.saved).toBe(1)
    expect(mock.tasker).toHaveBeenCalledWith(expect.objectContaining({
      create: { userId: 'provider', countryCode: 'CA' },
    }))
    expect(mock.saveSkill).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ countryCode: 'CA', currency: 'CAD' }),
    }))
  })
  it('validates active market jobs before creating any provider profile', async () => {
    mock.jobs.mockResolvedValue([])
    const result = await put({ skills: [{ jobId: 'foreign-or-inactive' }] })
    expect(result.response.status).toBe(400)
    expect(mock.tasker).not.toHaveBeenCalled()
    expect(mock.transaction).not.toHaveBeenCalled()
  })

  it('wraps deletion, upserts and category sync in one transaction', async () => {
    mock.selections.mockResolvedValue([{
      jobId: 'old-service',
      job: { ...job, id: 'old-service' },
    }])
    const result = await put({ skills: [{ jobId: 'local-service' }] })
    expect(result.response.status).toBe(200)
    expect(mock.transaction).toHaveBeenCalledTimes(1)
    expect(mock.deleteSkills).toHaveBeenCalledWith({
      where: { taskerId: 'tasker-1', jobId: { in: ['old-service'] } },
    })
    expect(mock.saveSkill).toHaveBeenCalledTimes(1)
    expect(mock.taskerUpdate).toHaveBeenCalledTimes(1)
  })

  it('never sends a success response if a service upsert fails inside the transaction', async () => {
    mock.saveSkill.mockRejectedValue(new Error('database write failed'))
    const result = await put({ skills: [{ jobId: 'local-service' }] })
    expect(result.response.status).toBe(500)
    expect(mock.transaction).toHaveBeenCalledTimes(1)
    expect(mock.taskerUpdate).not.toHaveBeenCalled()
  })

  it('normalizes lowercase account country when creating a profile', async () => {
    mock.account = 'ca'
    expect((await put({ skills: [] })).response.status).toBe(200)
    expect(mock.tasker).toHaveBeenCalledWith(expect.objectContaining({
      create: { userId: 'provider', countryCode: 'CA' },
    }))
  })
})
