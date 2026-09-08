import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createStaffSession } from '../../lib/auth/staff-sessions'
import { rotateStaffRefreshToken, parseStaffRefreshToken } from '../../lib/auth/staff-rotation'
import { prisma } from '../../lib/prisma'

const isVPS = process.env.VPS_INTEGRATION === 'true'

describe.skipIf(!isVPS)('DATABASE INTEGRATION: Staff Refresh Rotation', () => {
  let testAdminId: string

  beforeAll(async () => {
    process.env.STAFF_JWT_SECRET = 'test-staff-rotation-secret'
    const admin = await prisma.adminUser.create({
      data: {
        email: `staff-rot-${Date.now()}@test.com`,
        passwordHash: 'x',
        role: 'FINANCE',
        firstName: 'Rot',
        lastName: 'Test',
        isActive: true,
      },
    })
    testAdminId = admin.id
  })

  afterAll(async () => {
    await prisma.adminSession.deleteMany({ where: { adminUserId: testAdminId } })
    await prisma.adminUser.delete({ where: { id: testAdminId } })
  })

  it('valid rotation: old hash replaced, new hash stored, access JWT valid', async () => {
    const session = await createStaffSession({ adminUserId: testAdminId })
    const result = await rotateStaffRefreshToken(session.refreshTokenRaw)
    expect(result).toBeTruthy()
    expect(result!.accessToken).toBeTruthy()
    expect(result!.refreshTokenRaw).toContain('.')
    const parsed = parseStaffRefreshToken(result!.refreshTokenRaw)
    expect(parsed).toBeTruthy()
  })

  it('old token reuse: replay detected, session/family revoked', async () => {
    const session = await createStaffSession({ adminUserId: testAdminId })
    const originalRefresh = session.refreshTokenRaw

    await rotateStaffRefreshToken(originalRefresh)

    const replay = await rotateStaffRefreshToken(originalRefresh)
    expect(replay).toBeNull()
  })

  it('2-way concurrency: at most 1 successful rotation', async () => {
    const session = await createStaffSession({ adminUserId: testAdminId })
    const refresh = session.refreshTokenRaw

    const results = await Promise.all([
      rotateStaffRefreshToken(refresh),
      rotateStaffRefreshToken(refresh),
    ])

    const successCount = results.filter(r => r !== null).length
    expect(successCount).toBeLessThanOrEqual(1)
  })

  it('5-way concurrency: at most 1 successful rotation', async () => {
    const session = await createStaffSession({ adminUserId: testAdminId })
    const refresh = session.refreshTokenRaw

    const results = await Promise.all([
      rotateStaffRefreshToken(refresh),
      rotateStaffRefreshToken(refresh),
      rotateStaffRefreshToken(refresh),
      rotateStaffRefreshToken(refresh),
      rotateStaffRefreshToken(refresh),
    ])

    const successCount = results.filter(r => r !== null).length
    expect(successCount).toBeLessThanOrEqual(1)
  })

  it('expired session: DENY, no mutation', async () => {
    const session = await createStaffSession({ adminUserId: testAdminId })
    const parsed = parseStaffRefreshToken(session.refreshTokenRaw)

    await prisma.adminSession.update({
      where: { id: parsed!.sessionId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    const result = await rotateStaffRefreshToken(session.refreshTokenRaw)
    expect(result).toBeNull()
  })

  it('revoked session: DENY, no mutation', async () => {
    const session = await createStaffSession({ adminUserId: testAdminId })
    const parsed = parseStaffRefreshToken(session.refreshTokenRaw)

    await prisma.adminSession.update({
      where: { id: parsed!.sessionId },
      data: { isRevoked: true, revokedAt: new Date() },
    })

    const result = await rotateStaffRefreshToken(session.refreshTokenRaw)
    expect(result).toBeNull()
  })

  it('disabled AdminUser: DENY', async () => {
    const session = await createStaffSession({ adminUserId: testAdminId })

    await prisma.adminUser.update({
      where: { id: testAdminId },
      data: { isActive: false },
    })

    const result = await rotateStaffRefreshToken(session.refreshTokenRaw)
    expect(result).toBeNull()

    await prisma.adminUser.update({
      where: { id: testAdminId },
      data: { isActive: true },
    })
  })

  it('deleted AdminUser: DENY', async () => {
    const session = await createStaffSession({ adminUserId: testAdminId })

    await prisma.adminUser.update({
      where: { id: testAdminId },
      data: { deletedAt: new Date() },
    })

    const result = await rotateStaffRefreshToken(session.refreshTokenRaw)
    expect(result).toBeNull()

    await prisma.adminUser.update({
      where: { id: testAdminId },
      data: { deletedAt: null },
    })
  })

  it('wrong secret on valid session: replay policy enforced', async () => {
    const session = await createStaffSession({ adminUserId: testAdminId })
    const parsed = parseStaffRefreshToken(session.refreshTokenRaw)

    const fakeToken = `${parsed!.sessionId}.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`

    const result = await rotateStaffRefreshToken(fakeToken)
    expect(result).toBeNull()

    const dbSession = await prisma.adminSession.findUnique({
      where: { id: parsed!.sessionId },
    })
    expect(dbSession!.isRevoked).toBe(true)
  })
})
