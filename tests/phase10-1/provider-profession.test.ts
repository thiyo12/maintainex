import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('Phase 10.1 — Provider Profession Capability', () => {
  let professionId: string
  let taskerProfileId: string
  let taskerProfessionId: string

  beforeAll(async () => {
    // Create test profession
    const prof = await prisma.profession.upsert({
      where: { slug: 'test-provider-prof' },
      update: {},
      create: { slug: 'test-provider-prof', i18nKey: 'professions.testProviderProf' },
    })
    professionId = prof.id

    // Find a real tasker (or create minimal test one)
    const tasker = await prisma.taskerProfile.findFirst()
    if (tasker) {
      taskerProfileId = tasker.id
    }
  })

  afterAll(async () => {
    await prisma.taskerProfessionSkill.deleteMany({ where: { taskerProfession: { profession: { slug: { startsWith: 'test-' } } } } })
    await prisma.taskerProfession.deleteMany({ where: { profession: { slug: { startsWith: 'test-' } } } })
    await prisma.professionSkill.deleteMany({ where: { profession: { slug: { startsWith: 'test-' } } } })
    await prisma.profession.deleteMany({ where: { slug: { startsWith: 'test-' } } })
    await prisma.$disconnect()
  })

  it('assigns a profession to a tasker', async () => {
    if (!taskerProfileId) return
    const tp = await prisma.taskerProfession.create({
      data: {
        taskerProfileId,
        professionId,
        status: 'PENDING',
      },
    })
    taskerProfessionId = tp.id
    expect(tp.status).toBe('PENDING')
    expect(tp.professionId).toBe(professionId)
  })

  it('rejects duplicate tasker-profession assignment', async () => {
    if (!taskerProfileId) return
    await expect(
      prisma.taskerProfession.create({
        data: { taskerProfileId, professionId, status: 'PENDING' },
      })
    ).rejects.toThrow()
  })

  it('approves a tasker profession', async () => {
    const approved = await prisma.taskerProfession.update({
      where: { id: taskerProfessionId },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: 'test-admin' },
    })
    expect(approved.status).toBe('APPROVED')
    expect(approved.approvedBy).toBe('test-admin')
  })

  it('lists tasker professions', async () => {
    if (!taskerProfileId) return
    const profs = await prisma.taskerProfession.findMany({
      where: { taskerProfileId },
      include: { profession: true, skills: true },
    })
    expect(profs.length).toBeGreaterThan(0)
  })
})
