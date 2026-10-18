import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { addTaskerProfessionSkill, addCompanyProfessionSkill } from '@/lib/profession'

const mocks = vi.hoisted(() => ({
  taskerFind: vi.fn(), companyFind: vi.fn(), skillFind: vi.fn(),
  taskerCreate: vi.fn(), companyCreate: vi.fn(),
}))
const db = {
  taskerProfession: { findUnique: mocks.taskerFind },
  companyProfession: { findUnique: mocks.companyFind },
  professionSkill: { findUnique: mocks.skillFind },
  taskerProfessionSkill: { create: mocks.taskerCreate },
  companyProfessionSkill: { create: mocks.companyCreate },
} as unknown as PrismaClient

async function add(kind: 'tasker' | 'company') {
  if (kind === 'tasker') {
    return addTaskerProfessionSkill(db, {
      taskerProfessionId: 'joined-prof', professionSkillId: 'skill-1',
    })
  }
  return addCompanyProfessionSkill(db, {
    companyProfessionId: 'joined-prof', professionSkillId: 'skill-1',
  })
}
function assigned(status: string, isActive = true) {
  return {
    id: 'joined-prof', professionId: 'prof-1', status,
    profession: { isActive },
  }
}
describe.each(['tasker', 'company'] as const)(
  'Phase 04 — %s profession skill writes obey onboarding and activation status',
  kind => {
    beforeEach(() => {
      vi.clearAllMocks()
      mocks.taskerFind.mockResolvedValue(assigned('PENDING'))
      mocks.companyFind.mockResolvedValue(assigned('PENDING'))
      mocks.skillFind.mockResolvedValue({
        id: 'skill-1', professionId: 'prof-1', isActive: true,
      })
      mocks.taskerCreate.mockResolvedValue({ id: 'link-1' })
      mocks.companyCreate.mockResolvedValue({ id: 'link-1' })
    })
    async function noWrite() {
      expect(mocks.taskerCreate).not.toHaveBeenCalled()
      expect(mocks.companyCreate).not.toHaveBeenCalled()
    }

    it.each(['PENDING', 'APPROVED'])(
      'allows valid skill attachment to a %s profession', async status => {
        const record = assigned(status)
        if (kind === 'tasker') mocks.taskerFind.mockResolvedValue(record)
        else mocks.companyFind.mockResolvedValue(record)
        await expect(add(kind)).resolves.toMatchObject({ id: 'link-1' })
      },
    )
    it.each(['REJECTED', 'SUSPENDED', 'UNKNOWN'])(
      'rejects new skills for a %s profession', async status => {
        const record = assigned(status)
        if (kind === 'tasker') mocks.taskerFind.mockResolvedValue(record)
        else mocks.companyFind.mockResolvedValue(record)
        await expect(add(kind)).rejects.toThrow('inactive profession')
        await noWrite()
      },
    )
    it('rejects deactivated parent professions even with APPROVED membership', async () => {
      const record = assigned('APPROVED', false)
      if (kind === 'tasker') mocks.taskerFind.mockResolvedValue(record)
      else mocks.companyFind.mockResolvedValue(record)
      await expect(add(kind)).rejects.toThrow('inactive profession')
      await noWrite()
    })
    it('rejects a skill under another profession before any relation write', async () => {
      mocks.skillFind.mockResolvedValue({
        id: 'skill-1', professionId: 'other-prof', isActive: true,
      })
      await expect(add(kind)).rejects.toThrow('does not belong')
      await noWrite()
    })
    it('rejects an inactive skill even under an approved profession', async () => {
      mocks.skillFind.mockResolvedValue({
        id: 'skill-1', professionId: 'prof-1', isActive: false,
      })
      await expect(add(kind)).rejects.toThrow('inactive skill')
      await noWrite()
    })
    it('rejects a missing membership without inspecting the skill catalogue', async () => {
      if (kind === 'tasker') mocks.taskerFind.mockResolvedValue(null)
      else mocks.companyFind.mockResolvedValue(null)
      await expect(add(kind)).rejects.toThrow('not found')
      expect(mocks.skillFind).not.toHaveBeenCalled()
      await noWrite()
    })
  },
)
