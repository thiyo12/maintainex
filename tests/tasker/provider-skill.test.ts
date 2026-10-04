import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { addTaskerProfessionSkill } from '../../lib/profession'

const prisma = new PrismaClient()

describe('Phase 10.1 — Provider Skill Domain Integrity', () => {
  let professionId: string
  let skillId: string
  let taskerProfileId: string
  let taskerProfessionId: string

  beforeAll(async () => {
    const prof = await prisma.profession.upsert({
      where: { slug: 'test-skill-fk-prof' },
      update: {},
      create: { slug: 'test-skill-fk-prof', i18nKey: 'professions.testSkillFkProf' },
    })
    professionId = prof.id

    const skill = await prisma.professionSkill.upsert({
      where: { professionId_slug: { professionId, slug: 'test-skill-fk' } },
      update: {},
      create: {
        professionId,
        slug: 'test-skill-fk',
        i18nKey: 'skills.test-skill-fk-prof.testSkillFk',
      },
    })
    skillId = skill.id

    const tasker = await prisma.taskerProfile.findFirst()
    if (tasker) taskerProfileId = tasker.id
  })

  afterAll(async () => {
    await prisma.taskerProfessionSkill.deleteMany({ where: { taskerProfession: { profession: { slug: { startsWith: 'test-' } } } } })
    await prisma.taskerProfession.deleteMany({ where: { profession: { slug: { startsWith: 'test-' } } } })
    await prisma.professionSkill.deleteMany({ where: { profession: { slug: { startsWith: 'test-' } } } })
    await prisma.profession.deleteMany({ where: { slug: { startsWith: 'test-' } } })
    await prisma.$disconnect()
  })

  it('adds a skill to a tasker profession', async () => {
    if (!taskerProfileId) return

    const tp = await prisma.taskerProfession.upsert({
      where: {
        taskerProfileId_professionId: { taskerProfileId, professionId },
      },
      update: {},
      create: { taskerProfileId, professionId, status: 'APPROVED' },
    })
    taskerProfessionId = tp.id

    const tps = await prisma.taskerProfessionSkill.create({
      data: {
        taskerProfessionId,
        professionSkillId: skillId,
      },
    })
    expect(tps.professionSkillId).toBe(skillId)
  })

  it('rejects skill from different profession', async () => {
    if (!taskerProfessionId) return

    // Create a skill in a different profession
    const otherProf = await prisma.profession.upsert({
      where: { slug: 'test-other-prof' },
      update: {},
      create: { slug: 'test-other-prof', i18nKey: 'professions.testOtherProf' },
    })
    const otherSkill = await prisma.professionSkill.upsert({
      where: { professionId_slug: { professionId: otherProf.id, slug: 'test-other-skill' } },
      update: {},
      create: {
        professionId: otherProf.id,
        slug: 'test-other-skill',
        i18nKey: 'skills.test-other-prof.testOtherSkill',
      },
    })

    await expect(
      addTaskerProfessionSkill(prisma, {
        taskerProfessionId,
        professionSkillId: otherSkill.id,
      })
    ).rejects.toThrow('Skill does not belong to this profession')

    // Cleanup
    await prisma.professionSkill.deleteMany({ where: { professionId: otherProf.id } })
    await prisma.profession.delete({ where: { id: otherProf.id } })
  })

  it('cascades deletion when tasker profession is deleted', async () => {
    if (!taskerProfessionId) return

    const countBefore = await prisma.taskerProfessionSkill.count({
      where: { taskerProfessionId },
    })

    // Delete the tasker profession
    await prisma.taskerProfession.delete({ where: { id: taskerProfessionId } })

    const countAfter = await prisma.taskerProfessionSkill.count({
      where: { taskerProfessionId },
    })
    expect(countAfter).toBe(0)
    taskerProfessionId = '' // Reset
  })
})
