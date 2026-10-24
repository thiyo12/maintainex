import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => ({ id: 'owner' }),
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/phase6/company-context', () => ({
  resolveCompanyContext: async () => ({
    context: { companyId: 'company', role: 'COMPANY_OWNER' }, error: null,
  }),
}))
vi.mock('@/lib/domain/company-job-assignment', () => ({
  listCompanyAssignments: mock.list,
}))
async function read(params: string) {
  const { GET } = await import('@/app/api/mobile/company/assignments/route')
  return GET(new NextRequest('http://localhost/api/mobile/company/assignments?companyId=company&' + params))
}
describe('Phase 04 — company assignment pagination is bounded and strict', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.list.mockResolvedValue({ assignments: [], total: 0 })
  })
  it.each(['limit=-5', 'limit=2.5', 'limit=20junk', 'limit=0',
    'limit=9007199254740992', 'offset=-1', 'offset=Infinity',
    'offset=100001', 'offset=1e3', 'offset=9007199254740992'])(
    'refuses malformed parameters %s before querying assignments', async params => {
      const response = await read(params)
      expect(response.status).toBe(400)
      expect(mock.list).not.toHaveBeenCalled()
    },
  )
  it('caps oversized valid limits and preserves nonnegative offset', async () => {
    const response = await read('limit=500&offset=12')
    expect(response.status).toBe(200)
    expect(mock.list).toHaveBeenCalledWith('company', {
      status: undefined, jobId: undefined, workerUserId: undefined,
      limit: 100, offset: 12,
    })
  })
  it('uses stable backwards-compatible pagination defaults', async () => {
    expect((await read('')).status).toBe(200)
    expect(mock.list).toHaveBeenCalledWith('company', expect.objectContaining({ limit: 50, offset: 0 }))
  })
})
