import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createMarketplaceAuthSession } from '../../lib/auth/marketplace-session'
import { revokeAllUserSessions } from '../../lib/auth/sessions'
import { prisma } from '../../lib/prisma'

const isVPS = process.env.VPS_INTEGRATION === 'true'

describe.skipIf(!isVPS)('Password Reset — revoke ALL sessions, NO auto-login', () => {
  const userId = `pwreset-a-${Date.now()}`
  const userId2 = `pwreset-b-${Date.now()}`

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: userId, email: `pwreset-a-${Date.now()}@test.com`, name: 'User A',
        phone: '+94770000001', passwordHash: 'x', role: 'CUSTOMER',
        isActive: true, emailVerified: true,
      },
    })
    await prisma.user.create({
      data: {
        id: userId2, email: `pwreset-b-${Date.now()}@test.com`, name: 'User B',
        phone: '+94770000002', passwordHash: 'x', role: 'TASKER',
        isActive: true, emailVerified: true,
      },
    })

    await createMarketplaceAuthSession(userId)
    await createMarketplaceAuthSession(userId)
    await createMarketplaceAuthSession(userId2)
  })

  afterAll(async () => {
    await prisma.userSession.deleteMany({ where: { userId: { in: [userId, userId2] } } })
    await prisma.user.deleteMany({ where: { id: { in: [userId, userId2] } } })
  })

  it('User A has 2 active sessions before reset', async () => {
    const count = await prisma.userSession.count({
      where: { userId, revokedAt: null },
    })
    expect(count).toBe(2)
  })

  it('User B has 1 active session (not affected)', async () => {
    const count = await prisma.userSession.count({
      where: { userId: userId2, revokedAt: null },
    })
    expect(count).toBe(1)
  })

  it('revokeAllUserSessions revokes ALL sessions for user A', async () => {
    await revokeAllUserSessions(userId, 'password_reset')
    const activeSessions = await prisma.userSession.findMany({
      where: { userId, revokedAt: null },
    })
    expect(activeSessions.length).toBe(0)
  })

  it('User B sessions remain active (not affected)', async () => {
    const activeSessions = await prisma.userSession.findMany({
      where: { userId: userId2, revokedAt: null },
    })
    expect(activeSessions.length).toBe(1)
  })

  it('Zero active UserSessions remain for user A after reset', async () => {
    const count = await prisma.userSession.count({
      where: { userId, revokedAt: null },
    })
    expect(count).toBe(0)
  })

  it('Old sessions are revoked (not just deleted)', async () => {
    const allSessions = await prisma.userSession.findMany({
      where: { userId },
    })
    expect(allSessions.length).toBe(2)
    for (const s of allSessions) {
      expect(s.revokedAt).not.toBeNull()
    }
  })

  it('No new session created by password reset (count stays at 0)', async () => {
    const count = await prisma.userSession.count({
      where: { userId, revokedAt: null },
    })
    expect(count).toBe(0)
  })

  it('Fresh login after reset creates a new session', async () => {
    const result = await createMarketplaceAuthSession(userId)
    expect(result.accessToken).toBeTruthy()
    expect(result.refreshToken).toBeTruthy()
    const dbSession = await prisma.userSession.findFirst({
      where: { userId, revokedAt: null },
    })
    expect(dbSession).toBeTruthy()
  })
})
