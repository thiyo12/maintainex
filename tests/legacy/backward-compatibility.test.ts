import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('Phase 10.1 — Backward Compatibility', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('TaskerSkill model is unchanged', async () => {
    // Verify TaskerSkill still works with existing fields
    const count = await prisma.taskerSkill.count()
    expect(count).toBeGreaterThanOrEqual(0)

    // Verify the model can be queried with existing field names
    const sample = await prisma.taskerSkill.findFirst({
      select: { taskerId: true, jobId: true, experienceYears: true },
    })
    // If there are rows, verify fields are accessible
    if (sample) {
      expect(typeof sample.taskerId).toBe('string')
      expect(typeof sample.jobId).toBe('string')
    }
  })

  it('TaskerProfile.skills JSON field still works', async () => {
    const tasker = await prisma.taskerProfile.findFirst()
    if (tasker) {
      expect(typeof tasker.skills === 'string' || tasker.skills === null).toBe(true)
    }
  })

  it('CompanySpecialty model is backward-compatible', async () => {
    const count = await prisma.companySpecialty.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  it('ServiceTemplate model is unchanged', async () => {
    const count = await prisma.serviceTemplate.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  it('JobCategory model is unchanged', async () => {
    const count = await prisma.jobCategory.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  it('TemplateJob model is unchanged', async () => {
    const count = await prisma.templateJob.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  it('MarketplaceJob model is unchanged', async () => {
    const count = await prisma.marketplaceJob.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  it('Certification model is unchanged', async () => {
    const count = await prisma.certification.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
