import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('Phase 10.1 — Service Requirement Semantics', () => {
  let professionId: string
  let skillId1: string
  let skillId2: string
  let serviceTemplateId: string
  let serviceProfReqId: string

  beforeAll(async () => {
    const prof = await prisma.profession.upsert({
      where: { slug: 'test-req-prof' },
      update: {},
      create: { slug: 'test-req-prof', i18nKey: 'professions.testReqProf' },
    })
    professionId = prof.id

    const s1 = await prisma.professionSkill.upsert({
      where: { professionId_slug: { professionId, slug: 'test-req-skill-1' } },
      update: {},
      create: { professionId, slug: 'test-req-skill-1', i18nKey: 'skills.testReqProf.skill1' },
    })
    skillId1 = s1.id

    const s2 = await prisma.professionSkill.upsert({
      where: { professionId_slug: { professionId, slug: 'test-req-skill-2' } },
      update: {},
      create: { professionId, slug: 'test-req-skill-2', i18nKey: 'skills.testReqProf.skill2' },
    })
    skillId2 = s2.id

    const st = await prisma.serviceTemplate.findFirst({ where: { isActive: true } })
    if (st) serviceTemplateId = st.id
  })

  afterAll(async () => {
    await prisma.serviceSkillRequirement.deleteMany({ where: { serviceProfessionRequirement: { profession: { slug: { startsWith: 'test-' } } } } })
    await prisma.serviceProfessionRequirement.deleteMany({ where: { profession: { slug: { startsWith: 'test-' } } } })
    await prisma.professionSkill.deleteMany({ where: { profession: { slug: { startsWith: 'test-' } } } })
    await prisma.profession.deleteMany({ where: { slug: { startsWith: 'test-' } } })
    await prisma.$disconnect()
  })

  it('creates a service profession requirement', async () => {
    if (!serviceTemplateId) return
    const req = await prisma.serviceProfessionRequirement.create({
      data: {
        serviceTemplateId,
        professionId,
      },
    })
    serviceProfReqId = req.id
    expect(req.professionId).toBe(professionId)
  })

  it('creates skill requirements with different modes', async () => {
    if (!serviceProfReqId) return

    const r1 = await prisma.serviceSkillRequirement.create({
      data: {
        serviceProfessionReqId: serviceProfReqId,
        professionSkillId: skillId1,
        requirementMode: 'REQUIRED_ALL',
      },
    })
    expect(r1.requirementMode).toBe('REQUIRED_ALL')

    const r2 = await prisma.serviceSkillRequirement.create({
      data: {
        serviceProfessionReqId: serviceProfReqId,
        professionSkillId: skillId2,
        requirementMode: 'PREFERRED',
      },
    })
    expect(r2.requirementMode).toBe('PREFERRED')
  })

  it('supports alternative group IDs', async () => {
    if (!serviceTemplateId) return
    const req = await prisma.serviceProfessionRequirement.create({
      data: {
        serviceTemplateId,
        professionId,
        alternativeGroupId: 'test-alt-group',
      },
    })
    expect(req.alternativeGroupId).toBe('test-alt-group')
    // Cleanup
    await prisma.serviceSkillRequirement.deleteMany({ where: { serviceProfessionReqId: req.id } })
    await prisma.serviceProfessionRequirement.delete({ where: { id: req.id } })
  })
})
