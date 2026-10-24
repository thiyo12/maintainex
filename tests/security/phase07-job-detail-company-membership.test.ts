import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const db = vi.hoisted(() => ({
  members: vi.fn(),
  assigned: vi.fn(),
  member: vi.fn(),
  ownedProfile: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    teamMember: { findMany: db.members, findFirst: db.member },
    companyJobAssignment: { findFirst: db.assigned },
    companyProfile: { findUnique: db.ownedProfile },
  },
}))

import { getReadableCompanyIds, getActiveAssignedCompanyId } from '@/lib/phase6/company-job-read-access'

describe('Phase 07 — private job detail requires actual active company membership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.members.mockResolvedValue([])
    db.member.mockResolvedValue(null)
    db.assigned.mockResolvedValue(null)
  })

  it('does not grant a company owner permanent access merely because a profile remains', async () => {
    db.ownedProfile.mockResolvedValue({ id: 'company' })
    expect(await getReadableCompanyIds('owner')).toEqual([])
    expect(db.ownedProfile).not.toHaveBeenCalled()
  })

  it('does not allow suspended or removed users into company quote context', async () => {
    db.members.mockResolvedValue([])
    expect(await getReadableCompanyIds('suspended')).toEqual([])
    expect(db.members).toHaveBeenCalledWith({
      where: { userId: 'suspended', status: 'ACTIVE' },
      select: { companyId: true, role: true },
    })
  })

  it('allows an active owner and manager with quotes:read without duplicates', async () => {
    db.members.mockResolvedValue([
      { companyId: 'c1', role: 'COMPANY_OWNER' },
      { companyId: 'c1', role: 'COMPANY_OWNER' },
      { companyId: 'c2', role: 'MANAGER' },
      { companyId: 'c3', role: 'DISPATCHER' },
      { companyId: 'c4', role: 'WORKER' },
    ])
    expect(await getReadableCompanyIds('manager')).toEqual(['c1', 'c2', 'c3'])
  })

  it('excludes active workers with no quotes:read permission', async () => {
    db.members.mockResolvedValue([{ companyId: 'c1', role: 'WORKER' }])
    expect(await getReadableCompanyIds('worker')).toEqual([])
  })

  it('denies historical assignments after membership removal', async () => {
    db.assigned.mockResolvedValue({ companyId: 'company' })
    expect(await getActiveAssignedCompanyId('job', 'worker')).toBeNull()
    expect(db.member).toHaveBeenCalledWith({
      where: { companyId: 'company', userId: 'worker', status: 'ACTIVE' },
      select: { id: true },
    })
  })

  it('permits an actual assigned active worker to read only their company job', async () => {
    db.assigned.mockResolvedValue({ companyId: 'company' })
    db.member.mockResolvedValue({ id: 'active' })
    expect(await getActiveAssignedCompanyId('job', 'worker')).toBe('company')
    expect(db.assigned).toHaveBeenCalledWith({
      where: {
        jobId: 'job', workerUserId: 'worker',
        status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] },
      },
      orderBy: { assignedAt: 'desc' },
      select: { companyId: true },
    })
  })

  it('does not grant access to users without a matching accepted assignment', async () => {
    db.assigned.mockResolvedValue(null)
    expect(await getActiveAssignedCompanyId('job', 'unrelated')).toBeNull()
    expect(db.member).not.toHaveBeenCalled()
  })

  it('routes booking details through the active-membership helpers', () => {
    const src = readFileSync(resolve(process.cwd(), 'app/api/mobile/v2/jobs/[id]/route.ts'), 'utf8')
    expect(src).toContain('getReadableCompanyIds(user.id)')
    expect(src).toContain('getActiveAssignedCompanyId(job.id, user.id)')
    expect(src).not.toContain('if (ownedCompany?.id) ids.push(ownedCompany.id)')
  })
})
