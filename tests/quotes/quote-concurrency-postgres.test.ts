import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'

const isDB = !!process.env.DATABASE_URL
const prisma = new PrismaClient()
const jobId = 'release-gate-quote-race-job'
const providerId = 'release-gate-quote-race-provider'

describe.skipIf(!isDB)('Release gate — quote concurrency', () => {
  beforeEach(async () => {
    await prisma.jobQuote.deleteMany({ where: { jobId, providerId } })
  })

  afterAll(async () => {
    await prisma.jobQuote.deleteMany({ where: { jobId, providerId } })
    await prisma.$disconnect()
  })

  it('allows exactly one concurrent PENDING quote per provider and job', async () => {
    const create = () => prisma.jobQuote.create({
      data: {
        jobId,
        providerId,
        providerType: 'INDIVIDUAL',
        price: 10000n,
        estimatedCompletionTime: '1 hour',
        attachments: '[]',
        status: 'PENDING',
      },
    })

    const results = await Promise.allSettled([create(), create()])
    const fulfilled = results.filter(result => result.status === 'fulfilled')
    const rejected = results.filter(result => result.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(await prisma.jobQuote.count({ where: { jobId, providerId, status: 'PENDING' } })).toBe(1)
  })
})
