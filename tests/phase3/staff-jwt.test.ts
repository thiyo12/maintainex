import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { signStaffAccessToken, verifyStaffAccessToken } from '../../lib/auth/staff-jwt'
import { generateStaffRefreshToken, parseStaffRefreshToken, verifyStaffRefreshSecret } from '../../lib/auth/staff-rotation'
import { createStaffSession, revokeStaffSession, revokeAllStaffSessions, getActiveStaffSession } from '../../lib/auth/staff-sessions'
import { prisma } from '../../lib/prisma'

const isVPS = process.env.VPS_INTEGRATION === 'true'
const STAFF_SECRET = 'test-staff-secret-for-3d'

function setEnv() {
  process.env.STAFF_JWT_SECRET = STAFF_SECRET
}

describe.skipIf(!isVPS)('Staff JWT — Sign & Verify', () => {
  beforeAll(() => setEnv())

  it('signs and verifies a valid token', () => {
    const token = signStaffAccessToken('admin-1', 'session-1')
    const claims = verifyStaffAccessToken(token)
    expect(claims).toBeTruthy()
    expect(claims!.sub).toBe('admin-1')
    expect(claims!.sid).toBe('session-1')
    expect(claims!.aud).toBe('maintainex-staff')
    expect(claims!.iss).toBe('maintainex')
    expect(claims!.type).toBe('staff_access')
  })

  it('rejects token with wrong audience', () => {
    const token = jwt.sign({ sub: 'a', sid: 's', aud: 'wrong', iss: 'maintainex', type: 'staff_access' }, STAFF_SECRET, { expiresIn: '30m' })
    expect(verifyStaffAccessToken(token)).toBeNull()
  })

  it('rejects token with wrong issuer', () => {
    const token = jwt.sign({ sub: 'a', sid: 's', aud: 'maintainex-staff', iss: 'wrong', type: 'staff_access' }, STAFF_SECRET, { expiresIn: '30m' })
    expect(verifyStaffAccessToken(token)).toBeNull()
  })

  it('rejects token with wrong type', () => {
    const token = jwt.sign({ sub: 'a', sid: 's', aud: 'maintainex-staff', iss: 'maintainex', type: 'marketplace_access' }, STAFF_SECRET, { expiresIn: '30m' })
    expect(verifyStaffAccessToken(token)).toBeNull()
  })

  it('rejects token with missing sid', () => {
    const token = jwt.sign({ sub: 'a', aud: 'maintainex-staff', iss: 'maintainex', type: 'staff_access' }, STAFF_SECRET, { expiresIn: '30m' })
    expect(verifyStaffAccessToken(token)).toBeNull()
  })

  it('rejects expired token', () => {
    const token = jwt.sign({ sub: 'a', sid: 's', aud: 'maintainex-staff', iss: 'maintainex', type: 'staff_access' }, STAFF_SECRET, { expiresIn: '-1s' })
    expect(verifyStaffAccessToken(token)).toBeNull()
  })

  it('rejects token signed with wrong secret', () => {
    const token = jwt.sign({ sub: 'a', sid: 's', aud: 'maintainex-staff', iss: 'maintainex', type: 'staff_access' }, 'wrong-secret', { expiresIn: '30m' })
    expect(verifyStaffAccessToken(token)).toBeNull()
  })

  it('rejects marketplace token signed with staff secret', () => {
    const token = jwt.sign({ sub: 'u1', sid: 's1', aud: 'maintainex-marketplace', iss: 'maintainex', type: 'marketplace_access' }, STAFF_SECRET, { expiresIn: '15m' })
    expect(verifyStaffAccessToken(token)).toBeNull()
  })

  it('does not include role, email, or permissions in claims', () => {
    const token = signStaffAccessToken('admin-1', 'session-1')
    const decoded = jwt.decode(token) as any
    expect(decoded.role).toBeUndefined()
    expect(decoded.email).toBeUndefined()
    expect(decoded.firstName).toBeUndefined()
    expect(decoded.lastName).toBeUndefined()
    expect(decoded.assignedCountries).toBeUndefined()
  })
})

describe.skipIf(!isVPS)('Staff Refresh Token — Format Tests', () => {
  it('generates 128 hex char secret (64 bytes)', () => {
    const { raw } = generateStaffRefreshToken()
    expect(raw.length).toBe(128)
    expect(/^[0-9a-f]{128}$/.test(raw)).toBe(true)
  })

  it('generates different secrets on each call', () => {
    const t1 = generateStaffRefreshToken()
    const t2 = generateStaffRefreshToken()
    expect(t1.raw).not.toBe(t2.raw)
  })

  it('returns sha256 hash of secret', () => {
    const { raw, secretHash } = generateStaffRefreshToken()
    const expected = crypto.createHash('sha256').update(raw).digest('hex')
    expect(secretHash).toBe(expected)
  })

  it('parseRefreshToken rejects token without dot', () => {
    expect(parseStaffRefreshToken('nodothere')).toBeNull()
  })

  it('parseRefreshToken rejects empty string', () => {
    expect(parseStaffRefreshToken('')).toBeNull()
  })

  it('parseRefreshToken rejects token with short secret', () => {
    expect(parseStaffRefreshToken('session.abc')).toBeNull()
  })

  it('parseRefreshToken accepts valid format', () => {
    const secret = crypto.randomBytes(64).toString('hex')
    const result = parseStaffRefreshToken(`sess123.${secret}`)
    expect(result).toBeTruthy()
    expect(result!.sessionId).toBe('sess123')
    expect(result!.secret).toBe(secret)
  })

  it('verifyRefreshSecret returns true for matching', () => {
    const { raw, secretHash } = generateStaffRefreshToken()
    expect(verifyStaffRefreshSecret(raw, secretHash)).toBe(true)
  })

  it('verifyRefreshSecret returns false for wrong secret', () => {
    const { secretHash } = generateStaffRefreshToken()
    expect(verifyStaffRefreshSecret('wrong', secretHash)).toBe(false)
  })
})

describe.skipIf(!isVPS)('Staff Session — createStaffSession', () => {
  let testAdminId: string

  beforeAll(async () => {
    const admin = await prisma.adminUser.create({
      data: {
        email: `staff-test-${Date.now()}@test.com`,
        passwordHash: 'x',
        role: 'MANAGER',
        firstName: 'Test',
        lastName: 'Admin',
        isActive: true,
      },
    })
    testAdminId = admin.id
  })

  afterAll(async () => {
    await prisma.adminSession.deleteMany({ where: { adminUserId: testAdminId } })
    await prisma.adminUser.delete({ where: { id: testAdminId } })
  })

  it('creates session with valid tokens', async () => {
    const result = await createStaffSession({ adminUserId: testAdminId })
    expect(result.accessToken).toBeTruthy()
    expect(result.refreshTokenRaw).toContain('.')
    expect(result.user.id).toBe(testAdminId)
    expect(result.user.role).toBe('MANAGER')
  })

  it('rejects disabled AdminUser', async () => {
    await prisma.adminUser.update({ where: { id: testAdminId }, data: { isActive: false } })
    await expect(createStaffSession({ adminUserId: testAdminId })).rejects.toThrow()
    await prisma.adminUser.update({ where: { id: testAdminId }, data: { isActive: true } })
  })

  it('rejects deleted AdminUser', async () => {
    await prisma.adminUser.update({ where: { id: testAdminId }, data: { deletedAt: new Date() } })
    await expect(createStaffSession({ adminUserId: testAdminId })).rejects.toThrow()
    await prisma.adminUser.update({ where: { id: testAdminId }, data: { deletedAt: null } })
  })
})

describe.skipIf(!isVPS)('Staff Session — revokeStaffSession', () => {
  let testAdminId: string
  let sessionId: string

  beforeAll(async () => {
    const admin = await prisma.adminUser.create({
      data: {
        email: `staff-revoke-${Date.now()}@test.com`,
        passwordHash: 'x',
        role: 'SUPPORT',
        firstName: 'Revoke',
        lastName: 'Test',
        isActive: true,
      },
    })
    testAdminId = admin.id
    const session = await createStaffSession({ adminUserId: testAdminId })
    const parsed = parseStaffRefreshToken(session.refreshTokenRaw)
    sessionId = parsed!.sessionId
  })

  afterAll(async () => {
    await prisma.adminSession.deleteMany({ where: { adminUserId: testAdminId } })
    await prisma.adminUser.delete({ where: { id: testAdminId } })
  })

  it('revokes session', async () => {
    await revokeStaffSession(sessionId)
    const active = await getActiveStaffSession(sessionId)
    expect(active).toBeNull()
  })

  it('revokeAllStaffSessions revokes all', async () => {
    const s1 = await createStaffSession({ adminUserId: testAdminId })
    const s2 = await createStaffSession({ adminUserId: testAdminId })
    const p1 = parseStaffRefreshToken(s1.refreshTokenRaw)
    const p2 = parseStaffRefreshToken(s2.refreshTokenRaw)

    await revokeAllStaffSessions(testAdminId)

    expect(await getActiveStaffSession(p1!.sessionId)).toBeNull()
    expect(await getActiveStaffSession(p2!.sessionId)).toBeNull()
  })
})
