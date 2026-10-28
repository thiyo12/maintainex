import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'

const prisma = new PrismaClient()
const fixture = randomUUID()
const slug = `test-electrician-${fixture}`
const i18nKey = `professions.testElectrician-${fixture}`

describe('Phase 10.1 — Profession CRUD', () => {
  let professionId: string

  afterAll(async () => {
    // Cleanup: delete test data
    if (professionId) {
      await prisma.profession.deleteMany({ where: { id: professionId } })
    }
    await prisma.$disconnect()
  })

  it('creates a profession with valid data', async () => {
    const prof = await prisma.profession.create({
      data: {
        slug,
        i18nKey,
        description: 'Test electrician profession',
        sortOrder: 100,
      },
    })
    professionId = prof.id
    expect(prof.slug).toBe(slug)
    expect(prof.isActive).toBe(true)
  })

  it('rejects duplicate slug', async () => {
    await expect(
      prisma.profession.create({
        data: { slug, i18nKey: `${i18nKey}2` },
      })
    ).rejects.toThrow()
  })

  it('rejects duplicate i18nKey', async () => {
    await expect(
      prisma.profession.create({
        data: { slug: `${slug}-2`, i18nKey },
      })
    ).rejects.toThrow()
  })

  it('updates a profession', async () => {
    const updated = await prisma.profession.update({
      where: { id: professionId },
      data: { description: 'Updated description' },
    })
    expect(updated.description).toBe('Updated description')
  })

  it('deactivates a profession (soft delete)', async () => {
    const deactivated = await prisma.profession.update({
      where: { id: professionId },
      data: { isActive: false },
    })
    expect(deactivated.isActive).toBe(false)
  })

  it('re-activates a profession', async () => {
    const reactivated = await prisma.profession.update({
      where: { id: professionId },
      data: { isActive: true },
    })
    expect(reactivated.isActive).toBe(true)
  })

  it('lists active professions', async () => {
    const active = await prisma.profession.findMany({ where: { isActive: true } })
    expect(active.length).toBeGreaterThan(0)
  })
})
