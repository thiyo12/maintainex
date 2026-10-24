import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const state = vi.hoisted(() => ({
  actor: 'owner' as string | null,
  allow: true,
  preview: vi.fn(),
}))
vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => state.actor ? { id: state.actor } : null,
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/phase6/company-context', () => ({
  resolveCompanyContext: async () => state.allow
    ? { context: { companyId: 'company', role: 'COMPANY_OWNER' }, error: undefined }
    : { context: null, error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) },
}))
vi.mock('@/lib/domain/company-crew-readiness', () => ({
  CrewReadinessError: class CrewReadinessError extends Error {
    constructor(message: string, public readonly status: number) { super(message) }
  },
  previewCompanyCrewReadiness: state.preview,
}))

async function post(body: unknown) {
  const { POST } = await import('@/app/api/mobile/company/crew/readiness/route')
  return POST(new NextRequest('http://localhost/api/mobile/company/crew/readiness', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

describe('Phase 04 — authorized crew preview cannot mutate a booking', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    state.actor = 'owner'
    state.allow = true
    state.preview.mockResolvedValue({
      previewOnly: true, dispatchEnabled: false, preflightReady: false,
      requiredWorkersCount: 2, selectedWorkersCount: 0,
      blockers: ['Select exactly 2 distinct workers for this booking'], workers: [],
    })
  })

  it('requires authentication before revealing company/booking information', async () => {
    state.actor = null
    expect((await post({ companyId: 'company', jobId: 'job', workerUserIds: [] })).status).toBe(401)
    expect(state.preview).not.toHaveBeenCalled()
  })

  it('denies membership without workforce assignment permission', async () => {
    state.allow = false
    expect((await post({ companyId: 'company', jobId: 'job', workerUserIds: [] })).status).toBe(403)
    expect(state.preview).not.toHaveBeenCalled()
  })

  it.each([
    null,
    { companyId: 'company', jobId: 'job', workerUserIds: 'worker' },
    { companyId: null, jobId: 'job', workerUserIds: [] },
    { companyId: 'company', jobId: 'job', workerUserIds: null },
  ])('refuses malformed input before any preview or mutation %j', async input => {
    const response = await post(input)
    expect(response.status).toBe(400)
    expect(state.preview).not.toHaveBeenCalled()
  })

  it('scopes the request to the authorized company, with no cache and no dispatch', async () => {
    const response = await post({
      companyId: 'company', jobId: 'job', workerUserIds: ['a', 'b'],
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    const body = await response.json()
    expect(body.previewOnly).toBe(true)
    expect(body.dispatchEnabled).toBe(false)
    expect(state.preview).toHaveBeenCalledWith({
      companyId: 'company', jobId: 'job', workerUserIds: ['a', 'b'],
    })
  })

  it('has no non-handler exports or assignment/PIN mutation imports', () => {
    const source = readFileSync(resolve(process.cwd(),
      'app/api/mobile/company/crew/readiness/route.ts'), 'utf8')
    expect(source).toContain('export async function POST(')
    expect(source).not.toContain('createAssignment')
    expect(source).not.toContain('generateJobPin')
    expect(source).not.toContain('reassignWorker')
    expect(source).not.toContain('marketplaceJob.update')
  })
})
