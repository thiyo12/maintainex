import { describe, expect, it, vi } from 'vitest'
import { setServiceSkillRequirement } from '@/lib/profession'

describe('service skill requirement integrity', () => {
  it('rejects a skill from a different profession', async () => {
    const upsert = vi.fn()
    const client = {
      professionSkill: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'skill-b',
          isActive: true,
          professionId: 'profession-b',
        }),
      },
      serviceProfessionRequirement: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'req-a',
          professionId: 'profession-a',
        }),
      },
      serviceSkillRequirement: { upsert },
    } as any

    await expect(
      setServiceSkillRequirement(client, {
        serviceProfessionReqId: 'req-a',
        professionSkillId: 'skill-b',
        requirementMode: 'REQUIRED_ALL',
      })
    ).rejects.toThrow('Skill does not belong to the required profession')

    expect(upsert).not.toHaveBeenCalled()
  })

  it('allows a skill from the same profession', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'skill-req-1' })
    const client = {
      professionSkill: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'skill-a',
          isActive: true,
          professionId: 'profession-a',
        }),
      },
      serviceProfessionRequirement: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'req-a',
          professionId: 'profession-a',
        }),
      },
      serviceSkillRequirement: { upsert },
    } as any

    await expect(
      setServiceSkillRequirement(client, {
        serviceProfessionReqId: 'req-a',
        professionSkillId: 'skill-a',
        requirementMode: 'PREFERRED',
      })
    ).resolves.toEqual({ id: 'skill-req-1' })

    expect(upsert).toHaveBeenCalledTimes(1)
  })
})
