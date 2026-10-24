import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { addTaskerProfessionSkill } from '../../lib/profession'

const prisma = new PrismaClient()
const fixture = randomUUID()
const professionSlug = `test-skill-fk-prof-${fixture}`
const professionI18nKey = `professions.testSkillFkProf-${fixture}`
const skillSlug = `test-skill-fk-${fixture}`
const skillI18nKey = `skills.test-skill-fk-prof.testSkillFk-${fixture}`

describe('Phase 10.1 — Provider Skill Domain Integrity', () => {
  let professionId: string
  let skillId: string
  let taskerProfileId: string
  let taskerProfessionId: string
  let otherProfessionId: string

  beforeAll(async () => {
    const prof = await prisma.profession.upsert({
      where: { slug: professionSlug },
      update: {},
      create: { slug: professionSlug, i18nKey: professionI18nKey },
    })
    professionId = prof.id

    const skill = await prisma.professionSkill.upsert({
      where: { professionId_slug: { professionId, slug: skillSlug } },
      update: {},
      create: {
        professionId,
        slug: skillSlug,
        i18nKey: skillI18nKey,
      },
    })
    skillId = skill.id

    const tasker = await prisma.taskerProfile.findFirst()
    if (tasker) taskerProfileId = tasker.id
  })

  afterAll(async () => {
    if (professionId) {
      await prisma.taskerProfessionSkill.deleteMany({ where: { taskerProfession: { professionId } } })
      await prisma.taskerProfession.deleteMany({ where: { professionId } })
      await prisma.professionSkill.deleteMany({ where: { professionId } })
      await prisma.profession.deleteMany({ where: { id: professionId } })
    }
    if (otherProfessionId) {
      await prisma.professionSkill.deleteMany({ where: { professionId: otherProfessionId } })
      await prisma.profession.deleteMany({ where: { id: otherProfessionId } })
    }
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
      where: { slug: `${professionSlug}-other` },
      update: {},
      create: { slug: `${professionSlug}-other`, i18nKey: `${professionI18nKey}Other` },
    })
    otherProfessionId = otherProf.id
    const otherSkill = await prisma.professionSkill.upsert({
      where: { professionId_slug: { professionId: otherProf.id, slug: `${skillSlug}-other` } },
      update: {},
      create: {
        professionId: otherProf.id,
        slug: `${skillSlug}-other`,
        i18nKey: `${skillI18nKey}Other`,
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
