import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const TEST_DB_URL = process.env.DATABASE_URL
const isVPS = TEST_DB_URL && TEST_DB_URL.includes('maintainex_test')

describe.skipIf(!isVPS)('DATABASE INTEGRATION: UserSession Service Functions', () => {
  let prisma: PrismaClient

  const TEST_USER_A = 'intg-test-user-a'
  const TEST_USER_B = 'intg-test-user-b'

  function uid() {
    return `intg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
  }

  beforeAll(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()
    await prisma.userSession.deleteMany({ where: { userId: { in: [TEST_USER_A, TEST_USER_B] } } })
    await prisma.user.deleteMany({ where: { id: { in: [TEST_USER_A, TEST_USER_B] } } })
    await prisma.user.create({
      data: { id: TEST_USER_A, email: 'intg-a@test.com', passwordHash: 'hash', name: 'Intg A', role: 'CUSTOMER', isActive: true, updatedAt: new Date() },
    })
    await prisma.user.create({
      data: { id: TEST_USER_B, email: 'intg-b@test.com', passwordHash: 'hash', name: 'Intg B', role: 'CUSTOMER', isActive: true, updatedAt: new Date() },
    })
  })

  afterAll(async () => {
    await prisma.userSession.deleteMany({ where: { userId: { in: [TEST_USER_A, TEST_USER_B] } } })
    await prisma.user.deleteMany({ where: { id: { in: [TEST_USER_A, TEST_USER_B] } } })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await prisma.userSession.deleteMany({ where: { userId: { in: [TEST_USER_A, TEST_USER_B] } } })
  })

  it('createSession creates valid session via production service', async () => {
    const { createSession } = await import('../../lib/auth/sessions')
    const { parseRefreshToken } = await import('../../lib/auth/refresh')

    const result = await createSession({ userId: TEST_USER_A, ipAddress: '10.0.0.1', userAgent: 'test-agent' })

    expect(result.sessionId).toBeTruthy()
    expect(result.refreshTokenRaw).toBeTruthy()
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now())

    const dbSession = await prisma.userSession.findUnique({ where: { id: result.sessionId } })
    expect(dbSession).not.toBeNull()
    expect(dbSession!.userId).toBe(TEST_USER_A)
    expect(dbSession!.refreshTokenHash).not.toBe('pending')
    expect(dbSession!.refreshTokenHash).toHaveLength(64)
    expect(dbSession!.tokenFamilyId).toBeTruthy()
    expect(dbSession!.ipAddress).toBe('10.0.0.1')
    expect(dbSession!.userAgent).toBe('test-agent')
    expect(dbSession!.revokedAt).toBeNull()

    const rawCheck = await prisma.userSession.findFirst({
      where: { OR: [{ refreshTokenHash: result.refreshTokenRaw }, { refreshTokenHash: `${result.sessionId}.` }] },
    })
    expect(rawCheck).toBeNull()

    const parsed = parseRefreshToken(result.refreshTokenRaw)
    expect(parsed).not.toBeNull()
    expect(parsed!.sessionId).toBe(result.sessionId)
  })

  it('getActiveSession returns valid session for correct user', async () => {
    const { createSession, getActiveSession } = await import('../../lib/auth/sessions')

    const { sessionId } = await createSession({ userId: TEST_USER_A })
    const session = await getActiveSession(sessionId, TEST_USER_A)
    expect(session).not.toBeNull()
    expect(session!.userId).toBe(TEST_USER_A)
  })

  it('getActiveSession denies wrong user', async () => {
    const { createSession, getActiveSession } = await import('../../lib/auth/sessions')

    const { sessionId } = await createSession({ userId: TEST_USER_A })
    const session = await getActiveSession(sessionId, TEST_USER_B)
    expect(session).toBeNull()
  })

  it('getActiveSession denies expired session', async () => {
    const { getActiveSession } = await import('../../lib/auth/sessions')

    const expired = await prisma.userSession.create({
      data: {
        userId: TEST_USER_A,
        refreshTokenHash: 'expired-hash',
        tokenFamilyId: uid(),
        expiresAt: new Date('2020-01-01'),
        ipAddress: 'test',
        userAgent: 'test',
      },
    })

    const session = await getActiveSession(expired.id, TEST_USER_A)
    expect(session).toBeNull()
  })

  it('getActiveSession denies revoked session', async () => {
    const { createSession, revokeSession, getActiveSession } = await import('../../lib/auth/sessions')

    const { sessionId } = await createSession({ userId: TEST_USER_A })
    await revokeSession(sessionId)
    const session = await getActiveSession(sessionId, TEST_USER_A)
    expect(session).toBeNull()
  })

  it('revokeSession is idempotent', async () => {
    const { createSession, revokeSession } = await import('../../lib/auth/sessions')

    const { sessionId } = await createSession({ userId: TEST_USER_A })
    await revokeSession(sessionId)
    await revokeSession(sessionId)

    const session = await prisma.userSession.findUnique({ where: { id: sessionId } })
    expect(session!.revokedAt).not.toBeNull()
    expect(session!.revokeReason).toBe('logout')
  })

  it('revokeAllUserSessions revokes A sessions, leaves B intact', async () => {
    const { createSession, revokeAllUserSessions } = await import('../../lib/auth/sessions')

    const a1 = await createSession({ userId: TEST_USER_A })
    const a2 = await createSession({ userId: TEST_USER_A })
    const b1 = await createSession({ userId: TEST_USER_B })

    await revokeAllUserSessions(TEST_USER_A)

    const a1s = await prisma.userSession.findUnique({ where: { id: a1.sessionId } })
    const a2s = await prisma.userSession.findUnique({ where: { id: a2.sessionId } })
    const b1s = await prisma.userSession.findUnique({ where: { id: b1.sessionId } })

    expect(a1s!.revokedAt).not.toBeNull()
    expect(a1s!.revokeReason).toBe('logout_all')
    expect(a2s!.revokedAt).not.toBeNull()
    expect(a2s!.revokeReason).toBe('logout_all')
    expect(b1s!.revokedAt).toBeNull()
  })

  it('revokeTokenFamily revokes target family, leaves other intact', async () => {
    const { revokeTokenFamily } = await import('../../lib/auth/sessions')

    const fam1 = uid()
    const fam2 = uid()

    const s1 = await prisma.userSession.create({
      data: { userId: TEST_USER_A, refreshTokenHash: 'h1', tokenFamilyId: fam1, expiresAt: new Date(Date.now() + 86400000), ipAddress: 'test', userAgent: 'test' },
    })
    const s2 = await prisma.userSession.create({
      data: { userId: TEST_USER_A, refreshTokenHash: 'h2', tokenFamilyId: fam1, expiresAt: new Date(Date.now() + 86400000), ipAddress: 'test', userAgent: 'test' },
    })
    const s3 = await prisma.userSession.create({
      data: { userId: TEST_USER_A, refreshTokenHash: 'h3', tokenFamilyId: fam2, expiresAt: new Date(Date.now() + 86400000), ipAddress: 'test', userAgent: 'test' },
    })

    await revokeTokenFamily(fam1)

    const f1 = await prisma.userSession.findUnique({ where: { id: s1.id } })
    const f2 = await prisma.userSession.findUnique({ where: { id: s2.id } })
    const f3 = await prisma.userSession.findUnique({ where: { id: s3.id } })

    expect(f1!.revokedAt).not.toBeNull()
    expect(f1!.revokeReason).toBe('replay_detected')
    expect(f2!.revokedAt).not.toBeNull()
    expect(f2!.revokeReason).toBe('replay_detected')
    expect(f3!.revokedAt).toBeNull()
  })

  it('refresh token end-to-end: generate → parse → lookup → verify', async () => {
    const { createSession } = await import('../../lib/auth/sessions')
    const { parseRefreshToken, verifyRefreshSecret } = await import('../../lib/auth/refresh')

    const { sessionId, refreshTokenRaw } = await createSession({ userId: TEST_USER_A })

    const parsed = parseRefreshToken(refreshTokenRaw)
    expect(parsed).not.toBeNull()
    expect(parsed!.sessionId).toBe(sessionId)

    const dbSession = await prisma.userSession.findUnique({ where: { id: parsed!.sessionId } })
    expect(dbSession).not.toBeNull()
    expect(dbSession!.userId).toBe(TEST_USER_A)

    const match = verifyRefreshSecret(parsed!.secret, dbSession!.refreshTokenHash!)
    expect(match).toBe(true)

    const wrongMatch = verifyRefreshSecret('wrong-secret-value-that-is-long-enough-for-the-check', dbSession!.refreshTokenHash!)
    expect(wrongMatch).toBe(false)
  })
})
