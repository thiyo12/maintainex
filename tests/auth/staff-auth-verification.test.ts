import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { PATCH } from '@/app/api/admin/companies/[id]/verification/route'
import { requiresPostgres } from '../helpers/test-guard'

const prisma = new PrismaClient()

const STAFF_SECRET = 'test-staff-auth-verification-secret'
const ORIGINAL_STAFF = process.env.STAFF_JWT_SECRET

let sessionCounter = 0
function uniqueHash() { return crypto.createHash('sha256').update(`sess-${Date.now()}-${sessionCounter++}`).digest('hex') }

function signToken(sub: string, sid: string, overrides?: Record<string, unknown>) {
  return jwt.sign(
    { sub, sid, aud: 'maintainex-staff', iss: 'maintainex', type: 'staff_access', ...overrides },
    STAFF_SECRET,
    { expiresIn: '30m' }
  )
}

function makeRequest(token: string | null, body: Record<string, unknown>, companyId: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return new NextRequest(`https://test.com/api/admin/companies/${companyId}/verification`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  })
}

describe.skipIf(!requiresPostgres())('Phase 6.6 — Route-Level Staff Auth (Company Verification)', () => {
  let companyId: string
  let superAdminId: string, managerId: string, userMgmtId: string, financeId: string, supportId: string, technicalId: string
  let superAdminSessionId: string, managerSessionId: string, userMgmtSessionId: string
  let superAdminToken: string, managerToken: string, userMgmtToken: string, financeToken: string, supportToken: string, technicalToken: string
  let revokedSessionId: string, revokedToken: string
  let expiredToken: string
  let inactiveAdminId: string, inactiveSessionId: string, inactiveToken: string
  let deletedAdminId: string, deletedSessionId: string, deletedToken: string
  let wrongSecretToken: string

  beforeAll(async () => {
    process.env.STAFF_JWT_SECRET = STAFF_SECRET
    const ts = Date.now()

    const superAdmin = await prisma.adminUser.create({
      data: { email: `sa-route-${ts}@test.com`, passwordHash: 'x', role: 'SUPER_ADMIN', firstName: 'SA', lastName: 'Test', isActive: true },
    })
    superAdminId = superAdmin.id
    const saSession = await prisma.adminSession.create({
      data: { adminUserId: superAdminId, refreshTokenHash: uniqueHash(), tokenFamilyId: 'f1', expiresAt: new Date(Date.now() + 86400000) },
    })
    superAdminSessionId = saSession.id
    superAdminToken = signToken(superAdminId, superAdminSessionId)

    const manager = await prisma.adminUser.create({
      data: { email: `mgr-route-${ts}@test.com`, passwordHash: 'x', role: 'MANAGER', firstName: 'Mgr', lastName: 'Test', isActive: true },
    })
    managerId = manager.id
    const mgrSession = await prisma.adminSession.create({
      data: { adminUserId: managerId, refreshTokenHash: uniqueHash(), tokenFamilyId: 'f2', expiresAt: new Date(Date.now() + 86400000) },
    })
    managerSessionId = mgrSession.id
    managerToken = signToken(managerId, managerSessionId)

    const userMgmt = await prisma.adminUser.create({
      data: { email: `um-route-${ts}@test.com`, passwordHash: 'x', role: 'USER_MANAGEMENT', firstName: 'UM', lastName: 'Test', isActive: true },
    })
    userMgmtId = userMgmt.id
    const umSession = await prisma.adminSession.create({
      data: { adminUserId: userMgmtId, refreshTokenHash: uniqueHash(), tokenFamilyId: 'f3', expiresAt: new Date(Date.now() + 86400000) },
    })
    userMgmtSessionId = umSession.id
    userMgmtToken = signToken(userMgmtId, userMgmtSessionId)

    const finance = await prisma.adminUser.create({
      data: { email: `fin-route-${ts}@test.com`, passwordHash: 'x', role: 'FINANCE', firstName: 'Fin', lastName: 'Test', isActive: true },
    })
    financeId = finance.id
    const finSession = await prisma.adminSession.create({
      data: { adminUserId: financeId, refreshTokenHash: uniqueHash(), tokenFamilyId: 'f4', expiresAt: new Date(Date.now() + 86400000) },
    })
    financeToken = signToken(financeId, finSession.id)

    const support = await prisma.adminUser.create({
      data: { email: `sup-route-${ts}@test.com`, passwordHash: 'x', role: 'SUPPORT', firstName: 'Sup', lastName: 'Test', isActive: true },
    })
    supportId = support.id
    const supSession = await prisma.adminSession.create({
      data: { adminUserId: supportId, refreshTokenHash: uniqueHash(), tokenFamilyId: 'f5', expiresAt: new Date(Date.now() + 86400000) },
    })
    supportToken = signToken(supportId, supSession.id)

    const technical = await prisma.adminUser.create({
      data: { email: `tech-route-${ts}@test.com`, passwordHash: 'x', role: 'TECHNICAL', firstName: 'Tech', lastName: 'Test', isActive: true },
    })
    technicalId = technical.id
    const techSession = await prisma.adminSession.create({
      data: { adminUserId: technicalId, refreshTokenHash: uniqueHash(), tokenFamilyId: 'f6', expiresAt: new Date(Date.now() + 86400000) },
    })
    technicalToken = signToken(technicalId, techSession.id)

    const revokedAdmin = await prisma.adminUser.create({
      data: { email: `revoked-route-${ts}@test.com`, passwordHash: 'x', role: 'SUPER_ADMIN', firstName: 'Rev', lastName: 'Test', isActive: true },
    })
    const revokedSession = await prisma.adminSession.create({
      data: { adminUserId: revokedAdmin.id, refreshTokenHash: uniqueHash(), tokenFamilyId: 'f7', expiresAt: new Date(Date.now() + 86400000), isRevoked: true, revokedAt: new Date() },
    })
    revokedSessionId = revokedSession.id
    revokedToken = signToken(revokedAdmin.id, revokedSessionId)

    expiredToken = jwt.sign(
      { sub: superAdminId, sid: 'nonexistent-expired-sid', aud: 'maintainex-staff', iss: 'maintainex', type: 'staff_access', exp: Math.floor(Date.now() / 1000) - 3600 },
      STAFF_SECRET
    )

    const inactiveAdmin = await prisma.adminUser.create({
      data: { email: `inactive-route-${ts}@test.com`, passwordHash: 'x', role: 'SUPER_ADMIN', firstName: 'Ina', lastName: 'Test', isActive: false },
    })
    inactiveAdminId = inactiveAdmin.id
    const inactiveSession = await prisma.adminSession.create({
      data: { adminUserId: inactiveAdminId, refreshTokenHash: uniqueHash(), tokenFamilyId: 'f8', expiresAt: new Date(Date.now() + 86400000) },
    })
    inactiveToken = signToken(inactiveAdminId, inactiveSession.id)

    const deletedAdmin = await prisma.adminUser.create({
      data: { email: `deleted-route-${ts}@test.com`, passwordHash: 'x', role: 'SUPER_ADMIN', firstName: 'Del', lastName: 'Test', isActive: true, deletedAt: new Date() },
    })
    deletedAdminId = deletedAdmin.id
    const deletedSession = await prisma.adminSession.create({
      data: { adminUserId: deletedAdminId, refreshTokenHash: uniqueHash(), tokenFamilyId: 'f9', expiresAt: new Date(Date.now() + 86400000) },
    })
    deletedToken = signToken(deletedAdminId, deletedSession.id)

    wrongSecretToken = jwt.sign(
      { sub: superAdminId, sid: superAdminSessionId, aud: 'maintainex-staff', iss: 'maintainex', type: 'staff_access' },
      'wrong-secret-key',
      { expiresIn: '30m' }
    )

    const owner = await prisma.user.create({
      data: { email: `route-owner-${ts}@test.com`, passwordHash: 'hash', name: 'Owner', role: 'COMPANY', identityStatus: 'NOT_SUBMITTED' },
    })
    const company = await prisma.companyProfile.create({
      data: { userId: owner.id, companyName: `Route Test Co ${ts}`, services: '[]', serviceAreas: '[]', isVerified: false, verificationStatus: 'UNVERIFIED' },
    })
    companyId = company.id

    await prisma.teamMember.create({
      data: { companyId, userId: owner.id, name: 'Owner', role: 'COMPANY_OWNER', skills: '[]', status: 'ACTIVE' },
    })
  })

  afterAll(async () => {
    if (ORIGINAL_STAFF !== undefined) process.env.STAFF_JWT_SECRET = ORIGINAL_STAFF
    else delete process.env.STAFF_JWT_SECRET

    await prisma.teamMember.deleteMany({ where: { companyId } })
    await prisma.companyProfile.delete({ where: { id: companyId } }).catch(() => {})
    await prisma.adminSession.deleteMany({ where: { adminUserId: { in: [superAdminId, managerId, userMgmtId, financeId, supportId, technicalId, inactiveAdminId, deletedAdminId] } } })
    await prisma.adminUser.deleteMany({ where: { id: { in: [superAdminId, managerId, userMgmtId, financeId, supportId, technicalId, inactiveAdminId, deletedAdminId] } } })
  })

  it('SUPER_ADMIN with valid session → APPROVE allowed', async () => {
    await prisma.companyProfile.update({ where: { id: companyId }, data: { verificationStatus: 'PENDING' } })
    const res = await PATCH(makeRequest(superAdminToken, { action: 'APPROVE', reviewNote: 'ok' }, companyId), { params: Promise.resolve({ id: companyId }) })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.company.verificationStatus).toBe('VERIFIED')
    expect(data.company.isVerified).toBe(true)
  })

  it('MANAGER with valid session → allowed', async () => {
    await prisma.companyProfile.update({ where: { id: companyId }, data: { verificationStatus: 'PENDING', isVerified: false } })
    const res = await PATCH(makeRequest(managerToken, { action: 'APPROVE' }, companyId), { params: Promise.resolve({ id: companyId }) })
    expect(res.status).toBe(200)
  })

  it('USER_MANAGEMENT with valid session → allowed', async () => {
    await prisma.companyProfile.update({ where: { id: companyId }, data: { verificationStatus: 'PENDING', isVerified: false } })
    const res = await PATCH(makeRequest(userMgmtToken, { action: 'APPROVE' }, companyId), { params: Promise.resolve({ id: companyId }) })
    expect(res.status).toBe(200)
  })

  it('FINANCE → 403', async () => {
    await prisma.companyProfile.update({ where: { id: companyId }, data: { verificationStatus: 'PENDING' } })
    const res = await PATCH(makeRequest(financeToken, { action: 'APPROVE' }, companyId), { params: Promise.resolve({ id: companyId }) })
    expect(res.status).toBe(403)
  })

  it('SUPPORT → 403', async () => {
    await prisma.companyProfile.update({ where: { id: companyId }, data: { verificationStatus: 'PENDING' } })
    const res = await PATCH(makeRequest(supportToken, { action: 'APPROVE' }, companyId), { params: Promise.resolve({ id: companyId }) })
    expect(res.status).toBe(403)
  })

  it('TECHNICAL → 403', async () => {
    await prisma.companyProfile.update({ where: { id: companyId }, data: { verificationStatus: 'PENDING' } })
    const res = await PATCH(makeRequest(technicalToken, { action: 'APPROVE' }, companyId), { params: Promise.resolve({ id: companyId }) })
    expect(res.status).toBe(403)
  })

  it('marketplace user token → denied', async () => {
    const marketplaceToken = jwt.sign(
      { sub: superAdminId, sid: 'mkt-sid', aud: 'maintainex-marketplace', iss: 'maintainex', type: 'marketplace_access' },
      STAFF_SECRET,
      { expiresIn: '30m' }
    )
    const res = await PATCH(makeRequest(marketplaceToken, { action: 'APPROVE' }, companyId), { params: Promise.resolve({ id: companyId }) })
    expect(res.status).toBe(401)
  })

  it('random/invalid token → 401', async () => {
    const res = await PATCH(makeRequest('garbage-token-value', { action: 'APPROVE' }, companyId), { params: Promise.resolve({ id: companyId }) })
    expect(res.status).toBe(401)
  })

  it('expired staff session → 401', async () => {
    const res = await PATCH(makeRequest(expiredToken, { action: 'APPROVE' }, companyId), { params: Promise.resolve({ id: companyId }) })
    expect(res.status).toBe(401)
  })

  it('revoked AdminSession → 401', async () => {
    const res = await PATCH(makeRequest(revokedToken, { action: 'APPROVE' }, companyId), { params: Promise.resolve({ id: companyId }) })
    expect(res.status).toBe(401)
  })

  it('inactive AdminUser → 401', async () => {
    const res = await PATCH(makeRequest(inactiveToken, { action: 'APPROVE' }, companyId), { params: Promise.resolve({ id: companyId }) })
    expect(res.status).toBe(401)
  })

  it('deleted AdminUser → 401', async () => {
    const res = await PATCH(makeRequest(deletedToken, { action: 'APPROVE' }, companyId), { params: Promise.resolve({ id: companyId }) })
    expect(res.status).toBe(401)
  })

  it('token signed with wrong secret → 401', async () => {
    const res = await PATCH(makeRequest(wrongSecretToken, { action: 'APPROVE' }, companyId), { params: Promise.resolve({ id: companyId }) })
    expect(res.status).toBe(401)
  })

  it('wrong/nonexistent companyId → 404', async () => {
    const res = await PATCH(makeRequest(superAdminToken, { action: 'APPROVE' }, 'nonexistent-company-id'), { params: Promise.resolve({ id: 'nonexistent-company-id' }) })
    expect(res.status).toBe(404)
  })

  it('illegal company verification transition → zero writes', async () => {
    await prisma.companyProfile.update({ where: { id: companyId }, data: { verificationStatus: 'REJECTED' } })
    const before = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })
    const res = await PATCH(makeRequest(superAdminToken, { action: 'APPROVE' }, companyId), { params: Promise.resolve({ id: companyId }) })
    expect(res.status).toBe(400)
    const after = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })
    expect(after?.verificationStatus).toBe(before?.verificationStatus)
  })

  it('no Authorization header → 401', async () => {
    const res = await PATCH(makeRequest(null, { action: 'APPROVE' }, companyId), { params: Promise.resolve({ id: companyId }) })
    expect(res.status).toBe(401)
  })
})
