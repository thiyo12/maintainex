import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const mock = vi.hoisted(() => ({
  userId: 'customer',
  status: 'IN_PROGRESS',
  accepted: true,
  providerType: 'INDIVIDUAL',
  providerId: 'provider',
  activeMember: true,
  activeAssignment: true,
  jobFind: vi.fn(),
  quoteFind: vi.fn(),
  memberFind: vi.fn(),
  assignmentFind: vi.fn(),
  createWorkItem: vi.fn(),
}))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  authenticateRequest: async () => ({ id: mock.userId, isActive: true }),
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/prisma', () => ({ prisma: {
  marketplaceJob: { findUnique: mock.jobFind },
  jobQuote: { findFirst: mock.quoteFind },
  teamMember: { findFirst: mock.memberFind },
  companyJobAssignment: { findFirst: mock.assignmentFind },
} }))
vi.mock('@/lib/work-queue', () => ({ createWorkItem: mock.createWorkItem }))

async function report(reason = 'SAFETY_UNSAFE_WORK', description = 'Unsafe working conditions at the home') {
  const { POST } = await import('@/app/api/mobile/v2/jobs/[id]/safety-report/route')
  return POST(new NextRequest('http://localhost/api/mobile/v2/jobs/job/safety-report', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason, description }),
  }), { params: Promise.resolve({ id: 'job' }) })
}

describe('Phase 07 safety intake never mutates financial disputes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.userId = 'customer'
    mock.status = 'IN_PROGRESS'
    mock.accepted = true
    mock.providerType = 'INDIVIDUAL'
    mock.providerId = 'provider'
    mock.activeMember = true
    mock.activeAssignment = true
    mock.jobFind.mockImplementation(async () => ({
      id: 'job', customerId: 'customer', status: mock.status,
    }))
    mock.quoteFind.mockImplementation(async () => mock.accepted ? ({
      providerType: mock.providerType, providerId: mock.providerId,
    }) : null)
    mock.memberFind.mockImplementation(async () => mock.activeMember ? { id: 'member' } : null)
    mock.assignmentFind.mockImplementation(async () => mock.activeAssignment ? { id: 'assignment' } : null)
    mock.createWorkItem.mockResolvedValue({ id: 'alert' })
  })

  it('records a critical staff-queue alert for an authenticated customer', async () => {
    const r = await report()
    expect(r.status).toBe(201)
    expect(await r.json()).toMatchObject({ reportId: 'alert', status: 'RECEIVED' })
    expect(mock.createWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      category: 'tasker_escalation', severity: 'critical', priority: 'critical',
      targetTable: 'MarketplaceJob', targetId: 'job',
    }))
  })

  it('validates the incident category and text before database access', async () => {
    expect((await report('CURRENCY_DISPUTE')).status).toBe(400)
    expect((await report('SAFETY_INJURY', 'short')).status).toBe(400)
    expect((await report('SAFETY_INJURY', 'x'.repeat(2001))).status).toBe(400)
    expect(mock.jobFind).not.toHaveBeenCalled()
  })

  it('requires an accepted booking, not a draft job', async () => {
    mock.status = 'OPEN'
    expect((await report()).status).toBe(409)
    expect(mock.createWorkItem).not.toHaveBeenCalled()
  })

  it('requires an accepted quote even if the job claims to be in progress', async () => {
    mock.accepted = false
    expect((await report()).status).toBe(409)
    expect(mock.createWorkItem).not.toHaveBeenCalled()
  })

  it('permits the original individual provider', async () => {
    mock.userId = 'provider'
    expect((await report('SAFETY_INJURY')).status).toBe(201)
    expect(mock.memberFind).not.toHaveBeenCalled()
  })

  it('rejects an unrelated company member without this job assignment', async () => {
    mock.userId = 'manager'
    mock.providerType = 'COMPANY'
    mock.providerId = 'company'
    mock.activeAssignment = false
    expect((await report()).status).toBe(403)
    expect(mock.createWorkItem).not.toHaveBeenCalled()
  })

  it('rejects a removed worker even with a historical assignment', async () => {
    mock.userId = 'worker'
    mock.providerType = 'COMPANY'
    mock.providerId = 'company'
    mock.activeMember = false
    expect((await report()).status).toBe(403)
  })

  it('permits only a currently authorized company worker', async () => {
    mock.userId = 'worker'
    mock.providerType = 'COMPANY'
    mock.providerId = 'company'
    expect((await report('SAFETY_IDENTITY_MISMATCH')).status).toBe(201)
    expect(mock.assignmentFind).toHaveBeenCalledWith({
      where: {
        companyId: 'company', jobId: 'job', workerUserId: 'worker',
        status: { in: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] },
      },
      select: { id: true },
    })
  })

  it('retains reports after customer-approved completion', async () => {
    mock.status = 'COMPLETED'
    expect((await report()).status).toBe(201)
  })

  it('does not create escrow disputes or alter job state', () => {
    const source = readFileSync(resolve(process.cwd(),
      'app/api/mobile/v2/jobs/[id]/safety-report/route.ts'), 'utf8')
    expect(source).not.toContain('await raiseJobDispute(')
    expect(source).not.toContain('marketplaceJob.update')
    expect(source).not.toContain('jobEscrow.update')
    expect(source).not.toContain('releaseEscrow(')
    expect(source).toContain("targetTable: 'MarketplaceJob'")
  })
  it('wires customer, individual-provider and assigned-worker safety entry points', () => {
    const files = [
      'apps/mobile/features/jobs/screens/customer/v2/[id].tsx',
      'apps/mobile/features/jobs/screens/tasker/v2/manage/[id].tsx',
      'apps/mobile/features/company/screens/workforce/assignment/[id].tsx',
    ]
    for (const path of files) {
      const src = readFileSync(resolve(process.cwd(), path), 'utf8')
      expect(src).toContain('JobSafetyCentre')
    }
    const worker = readFileSync(resolve(process.cwd(),
      'apps/mobile/features/company/screens/workforce/assignment/[id].tsx'), 'utf8')
    expect(worker).toContain('assignment.capabilities?.isAssignedWorker')
  })

  it('makes emergency dialling optional and does not promise automatic response', () => {
    const src = readFileSync(resolve(process.cwd(),
      'apps/mobile/features/safety/components/JobSafetyCentre.tsx'), 'utf8')
    expect(src).toContain("Linking.openURL('tel:' + number)")
    expect(src).toContain("number: '911'")
    expect(src).toContain("number: '119'")
    expect(src).toContain("number: '1990'")
    expect(src).toContain('cannot dispatch responders')
    expect(src).toContain('Close without reporting')
    expect(src).toContain('does not automatically change a payment.')
  })

  it('uses the new safety route, not the escrow dispute operation', () => {
    const client = readFileSync(resolve(process.cwd(),
      'apps/mobile/api/v2-jobs.ts'), 'utf8')
    expect(client).toContain('reportSafety: (jobId: string')
    expect(client).toContain('/safety-report')
    expect(client).toContain('dispute: (jobId: string')
  })
})
