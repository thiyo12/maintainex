import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { GET as reportsGET } from '@/app/api/reports/route'
import { GET as exportGET } from '@/app/api/reports/export/route'
import { signAccessToken } from '@/lib/auth/authentication/admin-jwt'
import { prisma as appPrisma } from '@/lib/prisma'
import { requiresPostgres } from '../helpers/test-guard'
import type { AdminRole } from '@/lib/admin-types'

const prisma = new PrismaClient()

const TEST_JWT_SECRET = 'reports-authorization-test-secret-0123456789'
const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET

const STAMP = Date.now().toString(36)
const LK_BRANCH = `qual-rep-lk-${STAMP}`
const LK_BRANCH_2 = `qual-rep-lk2-${STAMP}`
const CA_BRANCH = `qual-rep-ca-${STAMP}`

let lkActivityId = ''
let caActivityId = ''

function token(role: AdminRole, assignedCountries: string[]) {
  return signAccessToken({
    id: `qual-reports-${role.toLowerCase()}-${STAMP}`,
    email: `qual-reports-${role.toLowerCase()}-${STAMP}@maintainex.test`,
    role,
    firstName: 'Qual',
    lastName: 'Reports',
    assignedCountries,
  })
}

const SUPER_TOKEN = () => token('SUPER_ADMIN', [] as string[])
const LK_MANAGER_TOKEN = () => token('MANAGER', ['LK'])
const CA_MANAGER_TOKEN = () => token('MANAGER', ['CA'])
const NO_COUNTRY_TOKEN = () => token('MANAGER', [] as string[])

function reportsRequest(authToken: string, query = '') {
  return new NextRequest(`https://test.com/api/reports${query}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  })
}

function exportRequest(authToken: string, query = '') {
  return new NextRequest(`https://test.com/api/reports/export${query}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  })
}

describe.skipIf(!requiresPostgres())('Reports authorization — canonical admin country scoping', () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET

    await prisma.branch.createMany({
      data: [
        { id: LK_BRANCH, name: 'Qual LK Branch', address: 'a', city: 'Colombo', region: 'LK', province: 'Western Province' },
        { id: LK_BRANCH_2, name: 'Qual LK Branch 2', address: 'b', city: 'Kandy', region: 'LK', province: 'Central Province' },
        { id: CA_BRANCH, name: 'Qual CA Branch', address: 'c', city: 'Toronto', region: 'CA', province: 'Ontario' },
      ],
    })

    const lk = await prisma.activityLog.create({
      data: {
        adminId: 'qual-lk-admin',
        adminEmail: 'qual-lk@maintainex.test',
        adminName: 'Qual LK Admin',
        branchId: LK_BRANCH,
        action: 'CREATE',
        entityType: 'BOOKING',
        description: 'LK scoped activity',
      },
    })
    lkActivityId = lk.id

    const ca = await prisma.activityLog.create({
      data: {
        adminId: 'qual-ca-admin',
        adminEmail: 'qual-ca@maintainex.test',
        adminName: 'Qual CA Admin',
        branchId: CA_BRANCH,
        action: 'CREATE',
        entityType: 'BOOKING',
        description: 'CA scoped activity',
      },
    })
    caActivityId = ca.id
  })

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { id: { in: [lkActivityId, caActivityId] } } })
    await prisma.branch.deleteMany({ where: { id: { in: [LK_BRANCH, LK_BRANCH_2, CA_BRANCH] } } })
    if (ORIGINAL_JWT_SECRET === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = ORIGINAL_JWT_SECRET
    await prisma.$disconnect()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('1. SUPER_ADMIN with no branch is allowed and sees every branch', async () => {
    const res = await reportsGET(reportsRequest(SUPER_TOKEN()))
    expect(res.status).toBe(200)

    const body = await res.json()
    const branchIds = (body.branches ?? []).map((b: { id: string }) => b.id)
    expect(branchIds).toContain(LK_BRANCH)
    expect(branchIds).toContain(CA_BRANCH)
    expect(body.isSuperAdmin).toBe(true)
  })

  it('2. SUPER_ADMIN with a branch is allowed and scoped to that branch', async () => {
    const res = await reportsGET(reportsRequest(SUPER_TOKEN(), `?branchId=${CA_BRANCH}`))
    expect(res.status).toBe(200)

    const body = await res.json()
    const branchIds = (body.branches ?? []).map((b: { id: string }) => b.id)
    expect(branchIds).toContain(CA_BRANCH)
    expect(body.currentBranch).toBe(CA_BRANCH)
  })

  it('3. non-super-admin with an assigned country and no branch sees only that country', async () => {
    const res = await reportsGET(reportsRequest(LK_MANAGER_TOKEN()))
    expect(res.status).toBe(200)

    const body = await res.json()
    const branchIds = (body.branches ?? []).map((b: { id: string }) => b.id)
    expect(branchIds).toContain(LK_BRANCH)
    expect(branchIds).toContain(LK_BRANCH_2)
    expect(branchIds).not.toContain(CA_BRANCH)

    const activityIds = (body.recentActivity ?? []).map((a: { id: string }) => a.id)
    expect(activityIds).toContain(lkActivityId)
    expect(activityIds).not.toContain(caActivityId)

    const adminIds = (body.adminList ?? []).map((a: { adminId: string }) => a.adminId)
    expect(adminIds).toContain('qual-lk-admin')
    expect(adminIds).not.toContain('qual-ca-admin')
  })

  it('4. non-super-admin with an allowed branch is allowed', async () => {
    const res = await reportsGET(reportsRequest(LK_MANAGER_TOKEN(), `?branchId=${LK_BRANCH_2}`))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.currentBranch).toBe(LK_BRANCH_2)
  })

  it('5. non-super-admin requesting a branch in another country gets 403', async () => {
    const res = await reportsGET(reportsRequest(LK_MANAGER_TOKEN(), `?branchId=${CA_BRANCH}`))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/outside your assigned countries/i)
  })

  it('6. non-super-admin without assigned countries gets 403', async () => {
    const res = await reportsGET(reportsRequest(NO_COUNTRY_TOKEN()))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/no country assigned/i)
  })

  it('7. non-super-admin requesting a nonexistent branch gets 404', async () => {
    const res = await reportsGET(reportsRequest(LK_MANAGER_TOKEN(), '?branchId=branch-does-not-exist'))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toMatch(/not found/i)
  })

  it('8. export endpoint enforces the same policy', async () => {
    const crossCountry = await exportGET(exportRequest(LK_MANAGER_TOKEN(), `?branchId=${CA_BRANCH}`))
    expect(crossCountry.status).toBe(403)

    const noCountries = await exportGET(exportRequest(NO_COUNTRY_TOKEN()))
    expect(noCountries.status).toBe(403)

    const missingBranch = await exportGET(exportRequest(LK_MANAGER_TOKEN(), '?branchId=branch-does-not-exist'))
    expect(missingBranch.status).toBe(404)

    const allowed = await exportGET(exportRequest(LK_MANAGER_TOKEN(), `?branchId=${LK_BRANCH}`))
    expect(allowed.status).toBe(200)
    expect(allowed.headers.get('content-type')).toContain('application/pdf')

    const superAllowed = await exportGET(exportRequest(SUPER_TOKEN(), `?branchId=${CA_BRANCH}`))
    expect(superAllowed.status).toBe(200)
  })

  it('9. editing the branchId query manually cannot cross the country boundary', async () => {
    for (const target of [CA_BRANCH, 'branch-does-not-exist']) {
      const res = await reportsGET(reportsRequest(LK_MANAGER_TOKEN(), `?branchId=${target}`))
      expect([403, 404]).toContain(res.status)

      const exportRes = await exportGET(exportRequest(LK_MANAGER_TOKEN(), `?branchId=${target}`))
      expect([403, 404]).toContain(exportRes.status)
    }

    // A CA admin cannot reach LK branches either.
    const caToLk = await reportsGET(reportsRequest(CA_MANAGER_TOKEN(), `?branchId=${LK_BRANCH}`))
    expect(caToLk.status).toBe(403)
  })

  it('10. no unscoped activityLog query runs for a non-super-admin', async () => {
    const findMany = vi.spyOn(appPrisma.activityLog, 'findMany')
    const count = vi.spyOn(appPrisma.activityLog, 'count')
    const groupBy = vi.spyOn(appPrisma.activityLog, 'groupBy')

    const res = await reportsGET(reportsRequest(LK_MANAGER_TOKEN()))
    expect(res.status).toBe(200)

    const whereOf = (args: unknown[]): any => (args[0] as any)?.where
    const expectScoped = (where: any) => {
      expect(where).toBeDefined()
      expect(where.branchId).toBeDefined()
    }

    expect(findMany).toHaveBeenCalled()
    for (const call of findMany.mock.calls) expectScoped(whereOf(call))
    expect(count).toHaveBeenCalled()
    for (const call of count.mock.calls) expectScoped(whereOf(call))
    expect(groupBy).toHaveBeenCalled()
    for (const call of groupBy.mock.calls) expectScoped(whereOf(call))

    // Export must not read activity without a branch scope either.
    findMany.mockClear()
    const exportRes = await exportGET(exportRequest(LK_MANAGER_TOKEN()))
    expect(exportRes.status).toBe(200)
    expect(findMany).toHaveBeenCalled()
    for (const call of findMany.mock.calls) expectScoped(whereOf(call))
  })
})
