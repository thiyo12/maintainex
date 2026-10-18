import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mock = vi.hoisted(() => ({
  user: { id: 'provider', role: 'TASKER', countryCode: 'CA' } as
    { id: string; role: string; countryCode: string | null } | null,
  suspended: false,
  upsert: vi.fn(), profileFind: vi.fn(), getProfessions: vi.fn(), assign: vi.fn(),
  getTaskerProfession: vi.fn(), addSkill: vi.fn(),
  profession: vi.fn(), professionSkills: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    taskerProfile: { upsert: mock.upsert, findUnique: mock.profileFind },
    taskerProfession: { findUnique: mock.getTaskerProfession },
    profession: { findUnique: mock.profession },
    professionSkill: { findMany: mock.professionSkills },
  },
}))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  authenticateRequest: async () => mock.user,
  assertNotSuspended: () => mock.suspended
    ? NextResponse.json({ error: 'Account suspended' }, { status: 403 }) : null,
}))
vi.mock('@/lib/profession', () => ({
  getTaskerProfessions: mock.getProfessions,
  assignTaskerProfession: mock.assign,
  addTaskerProfessionSkill: mock.addSkill,
}))
function request(path: string, method = 'GET', payload?: unknown) {
  return new NextRequest('http://localhost' + path, {
    method,
    ...(payload === undefined ? {} : {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  })
}
async function ownedGET() {
  const { GET } = await import('@/app/api/mobile/taskers/professions/route')
  return GET(request('/api/mobile/taskers/professions'))
}
async function professionPOST(payload: unknown = { professionId: 'prof-1' }, raw?: string) {
  const { POST } = await import('@/app/api/mobile/taskers/professions/route')
  const req = raw === undefined
    ? request('/api/mobile/taskers/professions', 'POST', payload)
    : new NextRequest('http://localhost/api/mobile/taskers/professions', { method: 'POST', body: raw })
  return POST(req)
}
async function skillPOST(payload: unknown = { taskerProfessionId: 'joined-1', professionSkillId: 'skill-1' }, raw?: string) {
  const { POST } = await import('@/app/api/mobile/taskers/professions/skills/route')
  const req = raw === undefined
    ? request('/api/mobile/taskers/professions/skills', 'POST', payload)
    : new NextRequest('http://localhost/api/mobile/taskers/professions/skills', { method: 'POST', body: raw })
  return POST(req)
}
async function publicSkills() {
  const { GET } = await import('@/app/api/mobile/v2/professions/[id]/skills/route')
  const response = await GET(request('/api/mobile/v2/professions/prof-1/skills'),
    { params: Promise.resolve({ id: 'prof-1' }) })
  return { response, body: await response.json() }
}

describe('Phase 04 — profession onboarding must never default foreign accounts to LK', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.user = { id: 'provider', role: 'TASKER', countryCode: 'CA' }
    mock.suspended = false
    mock.upsert.mockResolvedValue({ id: 'profile-1' })
    mock.profileFind.mockResolvedValue({ id: 'profile-1' })
    mock.getProfessions.mockResolvedValue([])
    mock.getTaskerProfession.mockImplementation(async ({ where }) =>
      where.id ? { id: 'joined-1', taskerProfileId: 'profile-1' } : null)
    mock.assign.mockResolvedValue({ id: 'joined-1' })
    mock.addSkill.mockResolvedValue({ id: 'skill-link-1' })
  })
  it.each([null, '', 'US', 'GB', 'ZZ'])(
    'rejects GET, profession POST and skill POST for account market %s without DB writes',
    async code => {
      mock.user = { id: 'provider', role: 'TASKER', countryCode: code }
      expect((await ownedGET()).status).toBe(400)
      expect((await professionPOST()).status).toBe(400)
      expect((await skillPOST()).status).toBe(400)
      expect(mock.upsert).not.toHaveBeenCalled()
      expect(mock.assign).not.toHaveBeenCalled()
      expect(mock.addSkill).not.toHaveBeenCalled()
    },
  )
  it.each(['CA', 'LK', 'ca', ' lk '])(
    'accepts and normalizes launch market %s on new profession profiles',
    async code => {
      mock.user = { id: 'provider', role: 'TASKER', countryCode: code }
      expect((await professionPOST()).status).toBe(201)
      expect(mock.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: { userId: 'provider', countryCode: code.trim().toUpperCase() },
      }))
      expect(mock.assign).toHaveBeenCalledTimes(1)
    },
  )
  it.each([
    ['null', null],
    ['missing field', {}],
    ['empty', { professionId: '' }],
    ['whitespace', { professionId: '   ' }],
    ['array', { professionId: ['prof-1'] }],
    ['object', { professionId: { id: 'prof-1' } }],
    ['number', { professionId: 5 }],
  ])('rejects invalid profession payload %s without creating a provider profile', async (_label, payload) => {
    const response = await professionPOST(payload)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'INVALID_PROFESSION_ID' })
    expect(mock.upsert).not.toHaveBeenCalled()
    expect(mock.assign).not.toHaveBeenCalled()
  })

  it('rejects malformed profession JSON without creating a provider profile', async () => {
    const response = await professionPOST({}, '{broken json')
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'INVALID_PROFESSION_ID' })
    expect(mock.upsert).not.toHaveBeenCalled()
  })

  it.each([
    ['null', null],
    ['missing skill', { taskerProfessionId: 'joined-1' }],
    ['empty parent', { taskerProfessionId: '', professionSkillId: 'skill-1' }],
    ['whitespace parent', { taskerProfessionId: '  ', professionSkillId: 'skill-1' }],
    ['array skill', { taskerProfessionId: 'joined-1', professionSkillId: ['skill-1'] }],
    ['object skill', { taskerProfessionId: 'joined-1', professionSkillId: { id: 'skill-1' } }],
  ])('rejects invalid profession-skill payload %s without creating a provider profile', async (_label, payload) => {
    const response = await skillPOST(payload)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'INVALID_PROFESSION_SKILL' })
    expect(mock.upsert).not.toHaveBeenCalled()
    expect(mock.addSkill).not.toHaveBeenCalled()
  })

  it('rejects malformed profession-skill JSON before any database writes', async () => {
    const response = await skillPOST({}, '{broken json')
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'INVALID_PROFESSION_SKILL' })
    expect(mock.upsert).not.toHaveBeenCalled()
  })

  it('rejects adding skills without an existing provider profile and creates no records', async () => {
    mock.profileFind.mockResolvedValue(null)
    const response = await skillPOST()
    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ code: 'TASKER_PROFILE_NOT_FOUND' })
    expect(mock.profileFind).toHaveBeenCalledWith({
      where: { userId: 'provider' }, select: { id: true },
    })
    expect(mock.upsert).not.toHaveBeenCalled()
    expect(mock.getTaskerProfession).not.toHaveBeenCalled()
    expect(mock.addSkill).not.toHaveBeenCalled()
  })

  it('blocks skill changes to a profession owned by another provider', async () => {
    mock.getTaskerProfession.mockResolvedValueOnce({
      id: 'joined-foreign', taskerProfileId: 'another-profile',
    })
    const response = await skillPOST({
      taskerProfessionId: 'joined-foreign', professionSkillId: 'skill-1',
    })
    expect(response.status).toBe(403)
    expect(mock.profileFind).toHaveBeenCalledTimes(1)
    expect(mock.upsert).not.toHaveBeenCalled()
    expect(mock.addSkill).not.toHaveBeenCalled()
  })

  it('attaches a skill using the existing profile without updating profile metadata', async () => {
    const response = await skillPOST()
    expect(response.status).toBe(201)
    expect(mock.profileFind).toHaveBeenCalledTimes(1)
    expect(mock.upsert).not.toHaveBeenCalled()
    expect(mock.addSkill).toHaveBeenCalledTimes(1)
  })

  it('normalizes padded identifiers before querying ownership or saving the skill', async () => {
    expect((await skillPOST({
      taskerProfessionId: ' joined-1 ', professionSkillId: ' skill-1 ',
    })).status).toBe(201)
    expect(mock.getTaskerProfession).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'joined-1' },
    }))
    expect(mock.addSkill).toHaveBeenCalledWith(expect.anything(), {
      taskerProfessionId: 'joined-1', professionSkillId: 'skill-1',
    })
  })

  it('preserves authorized skill and profession reads', async () => {
    expect((await ownedGET()).status).toBe(200)
    expect((await skillPOST()).status).toBe(201)
    expect(mock.addSkill).toHaveBeenCalledWith(expect.anything(), {
      taskerProfessionId: 'joined-1', professionSkillId: 'skill-1',
    })
  })
  it('rejects non-tasker and suspended provider requests before creating a profile', async () => {
    mock.user = { id: 'customer', role: 'CUSTOMER', countryCode: 'CA' }
    expect((await professionPOST()).status).toBe(401)
    mock.user = { id: 'provider', role: 'TASKER', countryCode: 'CA' }
    mock.suspended = true
    expect((await skillPOST()).status).toBe(403)
    expect(mock.upsert).not.toHaveBeenCalled()
  })
})

describe('Phase 04 — inactive professions cannot expose new skill selections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.profession.mockResolvedValue({
      id: 'prof-1', slug: 'plumbing', i18nKey: 'plumbing', isActive: true,
    })
    mock.professionSkills.mockResolvedValue([{ id: 'skill-1', slug: 'pipes' }])
  })
  it('preserves the active profession skills response', async () => {
    const { response, body } = await publicSkills()
    expect(response.status).toBe(200)
    expect(body.skills).toEqual([{ id: 'skill-1', slug: 'pipes' }])
  })
  it('returns 404 for an inactive profession without loading its skills', async () => {
    mock.profession.mockResolvedValue({ id: 'prof-1', isActive: false })
    expect((await publicSkills()).response.status).toBe(404)
    expect(mock.professionSkills).not.toHaveBeenCalled()
  })
  it('returns 404 for a missing profession without loading skills', async () => {
    mock.profession.mockResolvedValue(null)
    expect((await publicSkills()).response.status).toBe(404)
    expect(mock.professionSkills).not.toHaveBeenCalled()
  })
})
