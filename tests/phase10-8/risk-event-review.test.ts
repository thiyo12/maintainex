import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { reviewRiskEvent } from '../../lib/domain/admin-risk-event'
import type { AdminSession } from '../../lib/admin-types'

const prisma = new PrismaClient()

const ADMIN_SESSION: AdminSession = {
  id: 'admin-risk-108',
  email: 'admin-risk-108@test.com',
  role: 'MANAGER',
  firstName: 'Admin',
  lastName: 'Risk108',
  assignedCountries: ['LK'],
  authType: 'adminUser',
}

let riskEventId: string
let userId: string

afterAll(async () => {
  if (riskEventId) await prisma.marketplaceRiskEvent.delete({ where: { id: riskEventId } }).catch(() => {})
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {})
})

beforeAll(async () => {
  const user = await prisma.user.upsert({
    where: { email: 'risk-actor-108@phase108.com' },
    update: {},
    create: {
      email: 'risk-actor-108@phase108.com', passwordHash: 'dummy', name: 'Risk Actor',
      phone: '+94773000108', role: 'TASKER', countryCode: 'LK', identityStatus: 'VERIFIED',
    },
  })
  userId = user.id

  const event = await prisma.marketplaceRiskEvent.create({
    data: {
      eventType: 'SUSPICIOUS_BID_PATTERN',
      severity: 'HIGH',
      actorUserId: userId,
      metadata: '{"context":"suspicious bidding pattern detected"}',
    },
  })
  riskEventId = event.id

  await prisma.auditLog.deleteMany({ where: { adminUserId: 'admin-risk-108' } })
})

describe('Phase 10.8 — Risk Event Review', () => {
  it('confirm risk event with reason creates audit', async () => {
    const result = await reviewRiskEvent(prisma, {
      eventId: riskEventId,
      resolution: 'CONFIRMED',
      reason: 'Pattern confirmed as fraudulent',
      session: ADMIN_SESSION,
      ipAddress: '127.0.0.1',
    })

    expect(result.success).toBe(true)
    expect(result.resolution).toBe('CONFIRMED')

    const event = await prisma.marketplaceRiskEvent.findUnique({ where: { id: riskEventId } })
    expect(event!.resolution).toBe('CONFIRMED')
    expect(event!.reviewedAt).not.toBeNull()

    const audit = await prisma.auditLog.findFirst({
      where: { adminUserId: 'admin-risk-108', targetId: riskEventId, action: 'RISK_EVENT_RESOLVE' },
    })
    expect(audit).not.toBeNull()
  })

  it('review rejects already reviewed event', async () => {
    await expect(
      reviewRiskEvent(prisma, {
        eventId: riskEventId,
        resolution: 'DISMISSED',
        session: ADMIN_SESSION,
        ipAddress: '127.0.0.1',
      })
    ).rejects.toThrow('already reviewed')
  })

  it('confirm requires reason', async () => {
    const newEvent = await prisma.marketplaceRiskEvent.create({
      data: {
        eventType: 'FAKE_COMPLETION',
        severity: 'MEDIUM',
        actorUserId: userId,
        metadata: '{"context":"fake completion attempt"}',
      },
    })

    await expect(
      reviewRiskEvent(prisma, {
        eventId: newEvent.id,
        resolution: 'CONFIRMED',
        session: ADMIN_SESSION,
        ipAddress: '127.0.0.1',
      })
    ).rejects.toThrow('Reason is required')

    await prisma.marketplaceRiskEvent.delete({ where: { id: newEvent.id } })
  })

  it('dismiss without reason succeeds', async () => {
    const newEvent = await prisma.marketplaceRiskEvent.create({
      data: {
        eventType: 'COORDINATION_VIOLATION',
        severity: 'LOW',
        actorUserId: userId,
        metadata: '{"context":"minor coordination issue"}',
      },
    })

    const result = await reviewRiskEvent(prisma, {
      eventId: newEvent.id,
      resolution: 'DISMISSED',
      session: ADMIN_SESSION,
      ipAddress: '127.0.0.1',
    })

    expect(result.success).toBe(true)
    expect(result.resolution).toBe('DISMISSED')

    const audit = await prisma.auditLog.findFirst({
      where: { adminUserId: 'admin-risk-108', targetId: newEvent.id, action: 'RISK_EVENT_DISMISS' },
    })
    expect(audit).not.toBeNull()

    await prisma.marketplaceRiskEvent.delete({ where: { id: newEvent.id } })
  })

  it('review rejects non-existent event', async () => {
    await expect(
      reviewRiskEvent(prisma, {
        eventId: 'non-existent-id',
        resolution: 'CONFIRMED',
        reason: 'test',
        session: ADMIN_SESSION,
        ipAddress: '127.0.0.1',
      })
    ).rejects.toThrow('not found')
  })

  it('rejects invalid resolution', async () => {
    await expect(
      reviewRiskEvent(prisma, {
        eventId: riskEventId,
        resolution: 'INVALID' as any,
        session: ADMIN_SESSION,
        ipAddress: '127.0.0.1',
      })
    ).rejects.toThrow('Invalid resolution')
  })
})
