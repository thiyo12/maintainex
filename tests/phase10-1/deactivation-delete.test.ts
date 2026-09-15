import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('Phase 10.1 — Deactivation & Hard Delete Behavior', () => {
  let professionId: string
  let skillId: string

  beforeAll(async () => {
    const prof = await prisma.profession.upsert({
      where: { slug: 'test-deact-prof' },
      update: {},
      create: { slug: 'test-deact-prof', i18nKey: 'professions.testDeactProf' },
    })
    professionId = prof.id

    const skill = await prisma.professionSkill.upsert({
      where: { professionId_slug: { professionId, slug: 'test-deact-skill' } },
      update: {},
      create: { professionId, slug: 'test-deact-skill', i18nKey: 'skills.testDeactProf.deactSkill' },
    })
    skillId = skill.id
  })

  afterAll(async () => {
    await prisma.taskerProfessionSkill.deleteMany({ where: { taskerProfession: { profession: { slug: { startsWith: 'test-deact' } } } } })
    await prisma.taskerProfession.deleteMany({ where: { profession: { slug: { startsWith: 'test-deact' } } } })
    await prisma.serviceSkillRequirement.deleteMany({ where: { serviceProfessionRequirement: { profession: { slug: { startsWith: 'test-deact' } } } } })
    await prisma.serviceProfessionRequirement.deleteMany({ where: { profession: { slug: { startsWith: 'test-deact' } } } })
    await prisma.professionSkill.deleteMany({ where: { profession: { slug: { startsWith: 'test-deact' } } } })
    await prisma.profession.deleteMany({ where: { slug: { startsWith: 'test-deact' } } })
    await prisma.$disconnect()
  })

  it('deactivation is allowed', async () => {
    const prof = await prisma.profession.update({
      where: { id: professionId },
      data: { isActive: false },
    })
    expect(prof.isActive).toBe(false)

    // Restore
    await prisma.profession.update({ where: { id: professionId }, data: { isActive: true } })
  })

  it('hard delete of profession with no references succeeds', async () => {
    const tempProf = await prisma.profession.create({
      data: { slug: 'test-temp-delete', i18nKey: 'professions.testTempDelete' },
    })
    await prisma.profession.delete({ where: { id: tempProf.id } })
    const found = await prisma.profession.findUnique({ where: { id: tempProf.id } })
    expect(found).toBeNull()
  })

  it('hard delete of skill with no references succeeds', async () => {
    const tempSkill = await prisma.professionSkill.create({
      data: {
        professionId,
        slug: 'test-temp-skill-delete',
        i18nKey: 'skills.testTempDelete.tempSkill',
      },
    })
    await prisma.professionSkill.delete({ where: { id: tempSkill.id } })
    const found = await prisma.professionSkill.findUnique({ where: { id: tempSkill.id } })
    expect(found).toBeNull()
  })

  it('Restrict prevents deleting profession with TaskerProfession references', async () => {
    const tasker = await prisma.taskerProfile.findFirst()
    if (!tasker) return

    const tp = await prisma.taskerProfession.create({
      data: { taskerProfileId: tasker.id, professionId, status: 'PENDING' },
    })

    await expect(
      prisma.profession.delete({ where: { id: professionId } })
    ).rejects.toThrow()

    // Cleanup
    await prisma.taskerProfession.delete({ where: { id: tp.id } })
  })

  it('Restrict prevents deleting skill with ServiceSkillRequirement references', async () => {
    const st = await prisma.serviceTemplate.findFirst({ where: { isActive: true } })
    if (!st) return

    const req = await prisma.serviceProfessionRequirement.create({
      data: { serviceTemplateId: st.id, professionId },
    })

    const skillReq = await prisma.serviceSkillRequirement.create({
      data: {
        serviceProfessionReqId: req.id,
        professionSkillId: skillId,
        requirementMode: 'REQUIRED_ALL',
      },
    })

    await expect(
      prisma.professionSkill.delete({ where: { id: skillId } })
    ).rejects.toThrow()

    // Cleanup
    await prisma.serviceSkillRequirement.delete({ where: { id: skillReq.id } })
    await prisma.serviceProfessionRequirement.delete({ where: { id: req.id } })
  })
})
