import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { getProviderProfessionEligibility } from '@/lib/profession'

const mock = vi.hoisted(() => ({
  requirements: vi.fn(), taskers: vi.fn(), companies: vi.fn(),
}))
const db = {
  serviceProfessionRequirement: { findMany: mock.requirements },
  taskerProfession: { findMany: mock.taskers },
  companyProfession: { findMany: mock.companies },
} as unknown as PrismaClient

function qualification(professionActive = true, skills = ['skill-1']) {
  return {
    id: 'provider-prof', professionId: 'prof-1', status: 'APPROVED',
    profession: { isActive: professionActive },
    skills: skills.map(professionSkillId => ({ professionSkillId })),
  }
}
function requirement({
  professionActive = true, skillActive = true, mode = 'REQUIRED_ALL',
}: { professionActive?: boolean; skillActive?: boolean; mode?: 'REQUIRED_ALL' | 'REQUIRED_ANY_OF' } = {}) {
  return {
    id: 'req-1', professionId: 'prof-1',
    profession: { id: 'prof-1', isActive: professionActive },
    skillRequirements: [{
      professionSkillId: 'skill-1', requirementMode: mode,
      professionSkill: { id: 'skill-1', isActive: skillActive },
    }],
  }
}
describe.each(['tasker', 'company'] as const)(
  'Phase 04 — %s professional qualification checks honor activation',
  kind => {
    beforeEach(() => {
      vi.clearAllMocks()
      mock.requirements.mockResolvedValue([requirement()])
      mock.taskers.mockResolvedValue([qualification()])
      mock.companies.mockResolvedValue([qualification()])
    })
    const check = async () => getProviderProfessionEligibility(db, kind, 'provider-1', 'service-1')

    it('accepts an approved, active profession with an active required skill', async () => {
      const result = await check()
      expect(result).toEqual({
        eligible: true, matchedProfessionId: 'prof-1', matchedSkills: ['skill-1'],
      })
    })
    it('filters inactive parent professions and skills in the database query', async () => {
      await check()
      const query = (kind === 'tasker' ? mock.taskers : mock.companies).mock.calls[0][0]
      expect(query.where).toMatchObject({
        status: 'APPROVED', profession: { isActive: true },
      })
      expect(query.include).toMatchObject({
        profession: { select: { isActive: true } },
        skills: { where: { professionSkill: { isActive: true } } },
      })
    })
    it('rejects an inactive service-required profession even if provider was approved', async () => {
      mock.requirements.mockResolvedValue([requirement({ professionActive: false })])
      expect((await check()).eligible).toBe(false)
    })
    it('rejects stale provider qualifications from a deactivated profession', async () => {
      const finder = kind === 'tasker' ? mock.taskers : mock.companies
      finder.mockResolvedValue([qualification(false)])
      expect((await check()).eligible).toBe(false)
    })
    it('rejects a required skill that was deactivated after approval', async () => {
      mock.requirements.mockResolvedValue([requirement({ skillActive: false })])
      expect((await check()).eligible).toBe(false)
    })
    it('rejects a formerly approved provider with no active qualifications', async () => {
      const finder = kind === 'tasker' ? mock.taskers : mock.companies
      finder.mockResolvedValue([])
      expect((await check()).eligible).toBe(false)
    })
    it('supports REQUIRED_ANY_OF with an active matching skill', async () => {
      mock.requirements.mockResolvedValue([requirement({ mode: 'REQUIRED_ANY_OF' })])
      expect((await check()).eligible).toBe(true)
    })
    it('does not allow an inactive REQUIRED_ANY_OF skill to satisfy eligibility', async () => {
      mock.requirements.mockResolvedValue([requirement({ mode: 'REQUIRED_ANY_OF', skillActive: false })])
      expect((await check()).eligible).toBe(false)
    })
    it('preserves requirement-free services without requiring a profession', async () => {
      mock.requirements.mockResolvedValue([])
      expect((await check()).eligible).toBe(true)
      expect(kind === 'tasker' ? mock.taskers : mock.companies).not.toHaveBeenCalled()
    })
  },
)
