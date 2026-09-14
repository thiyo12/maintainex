import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('Phase 10.1 — Profession Submission Workflow', () => {
  let submissionId: string

  afterAll(async () => {
    await prisma.professionSubmission.deleteMany({ where: { requestedName: { startsWith: 'Test Profession' } } })
    await prisma.$disconnect()
  })

  it('creates a submission', async () => {
    const sub = await prisma.professionSubmission.create({
      data: {
        submittedById: 'test-user-id',
        requestedName: 'Test Profession Submission',
        description: 'A test profession submission',
        suggestedServices: JSON.stringify(['service-a', 'service-b']),
      },
    })
    submissionId = sub.id
    expect(sub.status).toBe('SUBMITTED')
  })

  it('reviews submission as approved', async () => {
    const reviewed = await prisma.professionSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'APPROVED',
        reviewedBy: 'test-admin',
        reviewedAt: new Date(),
        reviewNote: 'Looks good',
      },
    })
    expect(reviewed.status).toBe('APPROVED')
    expect(reviewed.reviewedBy).toBe('test-admin')
  })

  it('creates and rejects a submission', async () => {
    const sub = await prisma.professionSubmission.create({
      data: {
        submittedById: 'test-user-id',
        requestedName: 'Test Profession Rejected',
      },
    })
    const rejected = await prisma.professionSubmission.update({
      where: { id: sub.id },
      data: { status: 'REJECTED', reviewedBy: 'test-admin', reviewedAt: new Date() },
    })
    expect(rejected.status).toBe('REJECTED')
  })

  it('lists pending submissions', async () => {
    const pending = await prisma.professionSubmission.findMany({
      where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
    })
    expect(Array.isArray(pending)).toBe(true)
  })
})
