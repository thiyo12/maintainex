import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import type { AuthError as AuthErrorType } from '../../lib/auth/errors'

const TEST_DB_URL = process.env.DATABASE_URL
const isVPS = TEST_DB_URL && TEST_DB_URL.includes('maintainex_test')

describe.skipIf(!isVPS)('DATABASE INTEGRATION: Refresh Rotation Service', () => {
  let prisma: PrismaClient

  const TEST_USER_A = 'rot-test-user-a'
  const TEST_USER_B = 'rot-test-user-b'

  beforeAll(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()
    await prisma.userSession.deleteMany({ where: { userId: { in: [TEST_USER_A, TEST_USER_B] } } })
    await prisma.user.deleteMany({ where: { id: { in: [TEST_USER_A, TEST_USER_B] } } })
    await prisma.user.create({
      data: { id: TEST_USER_A, email: 'rot-a@test.com', passwordHash: 'hash', name: 'Rot A', role: 'CUSTOMER', isActive: true, updatedAt: new Date() },
    })
    await prisma.user.create({
      data: { id: TEST_USER_B, email: 'rot-b@test.com', passwordHash: 'hash', name: 'Rot B', role: 'CUSTOMER', isActive: true, updatedAt: new Date() },
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

  it('valid rotation: old hash replaced, new hash stored, access JWT valid', async () => {
    const { createSession } = await import('../../lib/auth/sessions')
    const { rotateMarketplaceRefreshToken } = await import('../../lib/auth/rotation')
    const { parseRefreshToken, verifyRefreshSecret } = await import('../../lib/auth/refresh')
    const { verifyMarketplaceAccessToken } = await import('../../lib/auth/marketplace-jwt')

    const { sessionId, refreshTokenRaw } = await createSession({ userId: TEST_USER_A })
    const oldParsed = parseRefreshToken(refreshTokenRaw)
    const oldSession = await prisma.userSession.findUnique({ where: { id: sessionId } })
    expect(oldSession).not.toBeNull()
    const oldHash = oldSession!.refreshTokenHash

    const result = await rotateMarketplaceRefreshToken(refreshTokenRaw, { ipAddress: '10.0.0.1', userAgent: 'test' })

    expect(result.accessToken).toBeTruthy()
    expect(result.refreshToken).toBeTruthy()
    expect(result.accessTokenExpiresAt.getTime()).toBeGreaterThan(Date.now())

    const newParsed = parseRefreshToken(result.refreshToken)
    expect(newParsed).not.toBeNull()
    expect(newParsed!.sessionId).toBe(sessionId)

    const newSession = await prisma.userSession.findUnique({ where: { id: sessionId } })
    expect(newSession).not.toBeNull()
    expect(newSession!.refreshTokenHash).not.toBe(oldHash)
    expect(verifyRefreshSecret(newParsed!.secret, newSession!.refreshTokenHash!)).toBe(true)

    const jwtClaims = verifyMarketplaceAccessToken(result.accessToken)
    expect(jwtClaims).not.toBeNull()
    expect(jwtClaims!.sub).toBe(TEST_USER_A)
    expect(jwtClaims!.sid).toBe(sessionId)

    const oldValid = verifyRefreshSecret(oldParsed!.secret, newSession!.refreshTokenHash!)
    expect(oldValid).toBe(false)
  })

  it('old token reuse: replay detected, session/family revoked', async () => {
    const { createSession } = await import('../../lib/auth/sessions')
    const { rotateMarketplaceRefreshToken } = await import('../../lib/auth/rotation')
    const { parseRefreshToken } = await import('../../lib/auth/refresh')
    const { AuthError } = await import('../../lib/auth/errors')

    const { sessionId, refreshTokenRaw } = await createSession({ userId: TEST_USER_A })
    await rotateMarketplaceRefreshToken(refreshTokenRaw)

    try {
      await rotateMarketplaceRefreshToken(refreshTokenRaw)
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthErrorType).code).toBe('TOKEN_REPLAY')
    }

    const session = await prisma.userSession.findUnique({ where: { id: sessionId } })
    expect(session!.revokedAt).not.toBeNull()
    expect(session!.revokeReason).toBe('replay_detected')
  })

  it('2-way concurrency: at most 1 successful rotation', async () => {
    const { createSession } = await import('../../lib/auth/sessions')
    const { rotateMarketplaceRefreshToken } = await import('../../lib/auth/rotation')

    const { refreshTokenRaw } = await createSession({ userId: TEST_USER_A })

    const results = await Promise.allSettled([
      rotateMarketplaceRefreshToken(refreshTokenRaw),
      rotateMarketplaceRefreshToken(refreshTokenRaw),
    ])

    const succeeded = results.filter(r => r.status === 'fulfilled')
    const failed = results.filter(r => r.status === 'rejected')

    expect(succeeded.length).toBeLessThanOrEqual(1)
    expect(failed.length).toBeGreaterThanOrEqual(1)

    if (succeeded.length === 1) {
      const value = (succeeded[0] as PromiseFulfilledResult<any>).value
      expect(value.accessToken).toBeTruthy()
      expect(value.refreshToken).toBeTruthy()
    }
  })

  it('5-way concurrency: at most 1 successful rotation', async () => {
    const { createSession } = await import('../../lib/auth/sessions')
    const { rotateMarketplaceRefreshToken } = await import('../../lib/auth/rotation')

    const { refreshTokenRaw } = await createSession({ userId: TEST_USER_A })

    const results = await Promise.allSettled([
      rotateMarketplaceRefreshToken(refreshTokenRaw),
      rotateMarketplaceRefreshToken(refreshTokenRaw),
      rotateMarketplaceRefreshToken(refreshTokenRaw),
      rotateMarketplaceRefreshToken(refreshTokenRaw),
      rotateMarketplaceRefreshToken(refreshTokenRaw),
    ])

    const succeeded = results.filter(r => r.status === 'fulfilled')
    const failed = results.filter(r => r.status === 'rejected')

    expect(succeeded.length).toBeLessThanOrEqual(1)
    expect(failed.length).toBeGreaterThanOrEqual(4)
  })

  it('expired session: DENY, no mutation', async () => {
    const { rotateMarketplaceRefreshToken } = await import('../../lib/auth/rotation')
    const { AuthError } = await import('../../lib/auth/errors')
    const { hashRefreshSecret } = await import('../../lib/auth/refresh')
    const crypto = await import('crypto')

    const secret = crypto.randomBytes(64).toString('hex')
    const hash = hashRefreshSecret(secret)
    const session = await prisma.userSession.create({
      data: {
        userId: TEST_USER_A,
        refreshTokenHash: hash,
        tokenFamilyId: crypto.randomUUID(),
        expiresAt: new Date('2020-01-01'),
        ipAddress: 'test',
        userAgent: 'test',
      },
    })

    try {
      await rotateMarketplaceRefreshToken(`${session.id}.${secret}`)
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthErrorType).code).toBe('SESSION_EXPIRED')
    }

    const after = await prisma.userSession.findUnique({ where: { id: session.id } })
    expect(after!.refreshTokenHash).toBe(hash)
    expect(after!.revokedAt).toBeNull()
  })

  it('revoked session: DENY, no mutation', async () => {
    const { createSession, revokeSession } = await import('../../lib/auth/sessions')
    const { rotateMarketplaceRefreshToken } = await import('../../lib/auth/rotation')
    const { AuthError } = await import('../../lib/auth/errors')

    const { sessionId, refreshTokenRaw } = await createSession({ userId: TEST_USER_A })
    await revokeSession(sessionId)

    try {
      await rotateMarketplaceRefreshToken(refreshTokenRaw)
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthErrorType).code).toBe('TOKEN_REPLAY')
    }
  })

  it('isActive=false: DENY', async () => {
    const { createSession } = await import('../../lib/auth/sessions')
    const { rotateMarketplaceRefreshToken } = await import('../../lib/auth/rotation')
    const { AuthError } = await import('../../lib/auth/errors')

    const { refreshTokenRaw } = await createSession({ userId: TEST_USER_A })
    await prisma.user.update({ where: { id: TEST_USER_A }, data: { isActive: false } })

    try {
      await rotateMarketplaceRefreshToken(refreshTokenRaw)
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthErrorType).code).toBe('ACCOUNT_DISABLED')
    }

    await prisma.user.update({ where: { id: TEST_USER_A }, data: { isActive: true } })
  })

  it('isBanned=true: DENY', async () => {
    const { createSession } = await import('../../lib/auth/sessions')
    const { rotateMarketplaceRefreshToken } = await import('../../lib/auth/rotation')
    const { AuthError } = await import('../../lib/auth/errors')

    const { refreshTokenRaw } = await createSession({ userId: TEST_USER_A })
    await prisma.user.update({ where: { id: TEST_USER_A }, data: { isBanned: true } })

    try {
      await rotateMarketplaceRefreshToken(refreshTokenRaw)
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthErrorType).code).toBe('ACCOUNT_BANNED')
    }

    await prisma.user.update({ where: { id: TEST_USER_A }, data: { isBanned: false } })
  })

  it('isSuspended=true: DENY', async () => {
    const { createSession } = await import('../../lib/auth/sessions')
    const { rotateMarketplaceRefreshToken } = await import('../../lib/auth/rotation')
    const { AuthError } = await import('../../lib/auth/errors')

    const { refreshTokenRaw } = await createSession({ userId: TEST_USER_A })
    await prisma.user.update({ where: { id: TEST_USER_A }, data: { isSuspended: true, suspendedUntil: new Date(Date.now() + 86400000) } })

    try {
      await rotateMarketplaceRefreshToken(refreshTokenRaw)
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthErrorType).code).toBe('ACCOUNT_SUSPENDED')
    }

    await prisma.user.update({ where: { id: TEST_USER_A }, data: { isSuspended: false, suspendedUntil: null } })
  })

  it('wrong secret on valid session: replay policy enforced', async () => {
    const { createSession } = await import('../../lib/auth/sessions')
    const { rotateMarketplaceRefreshToken } = await import('../../lib/auth/rotation')
    const { AuthError } = await import('../../lib/auth/errors')
    const crypto = await import('crypto')

    const { sessionId } = await createSession({ userId: TEST_USER_A })
    const wrongSecret = crypto.randomBytes(64).toString('hex')

    try {
      await rotateMarketplaceRefreshToken(`${sessionId}.${wrongSecret}`)
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthErrorType).code).toBe('TOKEN_REPLAY')
    }

    const session = await prisma.userSession.findUnique({ where: { id: sessionId } })
    expect(session!.revokedAt).not.toBeNull()
    expect(session!.revokeReason).toBe('replay_detected')
  })

  it('sub is always User belonging to session', async () => {
    const { createSession } = await import('../../lib/auth/sessions')
    const { rotateMarketplaceRefreshToken } = await import('../../lib/auth/rotation')
    const { verifyMarketplaceAccessToken } = await import('../../lib/auth/marketplace-jwt')

    const { sessionId, refreshTokenRaw } = await createSession({ userId: TEST_USER_A })
    const result = await rotateMarketplaceRefreshToken(refreshTokenRaw)

    const claims = verifyMarketplaceAccessToken(result.accessToken)
    expect(claims).not.toBeNull()
    expect(claims!.sub).toBe(TEST_USER_A)
    expect(claims!.sid).toBe(sessionId)
  })
})
