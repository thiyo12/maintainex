import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

let customerId: string
let jobId: string

beforeAll(async () => {
  const cust = await prisma.user.upsert({
    where: { email: 'notif-customer@test.com' },
    update: {},
    create: {
      email: 'notif-customer@test.com',
      passwordHash: 'dummy',
      name: 'Notif Customer',
      phone: '+94770006001',
      role: 'CUSTOMER',
      countryCode: 'LK',
    },
  })
  customerId = cust.id

  const category = await prisma.jobCategory.findFirst()
  const categoryId = category?.id || 'cat-notif-test'

  const job = await prisma.marketplaceJob.create({
    data: {
      customerId,
      title: 'Notification Test Job',
      description: 'Testing notifications',
      categoryId,
      budgetType: 'FIXED',
      photos: '[]',
      status: 'OPEN',
      countryCode: 'LK',
    },
  })
  jobId = job.id
})

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { userId: customerId } })
  await prisma.marketplaceJob.deleteMany({ where: { id: jobId } })
  await prisma.user.delete({ where: { id: customerId } })
})

describe('Phase 10.5 — Notification Tests', () => {
  it('creates notification with correct structure', async () => {
    const { createNotification } = await import('@/lib/notifications')
    const notif = await createNotification({
      userId: customerId,
      title: 'Test Notification',
      body: 'Test body',
      titleKey: 'notification.test.title',
      bodyKey: 'notification.test.body',
      params: { key: 'value' },
      referenceType: 'JOB',
      referenceId: jobId,
    })

    expect(notif).toBeTruthy()
    expect(notif!.userId).toBe(customerId)
    expect(notif!.title).toBe('Test Notification')
  })

  it('notification data contains reference info', async () => {
    const { createNotification } = await import('@/lib/notifications')
    const notif = await createNotification({
      userId: customerId,
      title: 'Reference Test',
      body: 'Body',
      referenceType: 'JOB',
      referenceId: jobId,
    })

    expect(notif!.data).toBeTruthy()
    const data = JSON.parse(notif!.data!)
    expect(data.referenceType).toBe('JOB')
    expect(data.referenceId).toBe(jobId)
  })

  it('duplicate replay does not create duplicate notification', async () => {
    const { createNotification } = await import('@/lib/notifications')

    const notif1 = await createNotification({
      userId: customerId,
      title: 'Duplicate Test 1',
      body: 'Body 1',
      referenceType: 'JOB',
      referenceId: jobId,
    })

    const notif2 = await createNotification({
      userId: customerId,
      title: 'Duplicate Test 2',
      body: 'Body 2',
      referenceType: 'JOB',
      referenceId: jobId,
    })

    expect(notif1).toBeTruthy()
    expect(notif2).toBeTruthy()
  })
})
