import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('legacy company workforce route invariants', () => {
  const workforce = read('app/api/mobile/company/workforce/route.ts')

  it('cannot demote or deactivate the last active company owner', () => {
    expect(workforce).toContain("oldRole === 'COMPANY_OWNER' && role !== 'COMPANY_OWNER'")
    expect(workforce).toContain("where: { companyId, role: 'COMPANY_OWNER', status: 'ACTIVE' }")
    expect(workforce).toContain("throw new Error('LAST_COMPANY_OWNER')")
  })

  it('cannot deactivate a worker while canonical work is in progress', () => {
    expect(workforce).toContain("status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] }")
    expect(workforce).toContain("activeAssignments.some(assignment => assignment.status === 'IN_PROGRESS')")
    expect(workforce).toContain("throw new Error('WORKER_HAS_IN_PROGRESS_JOB')")
  })

  it('revokes only pre-start assignments atomically when deactivating a worker', () => {
    expect(workforce).toContain("status: { in: ['ASSIGNED', 'ACCEPTED'] }")
    expect(workforce).toContain("status: 'QUOTE_ACCEPTED'")
    expect(workforce).toContain("data: { targetTaskerId: null }")
    expect(workforce).toContain("await prisma.$transaction(async tx =>")
  })

  it('does not reactivate company membership for a restricted global account', () => {
    expect(workforce).toContain('select: { isActive: true, isSuspended: true, isBanned: true }')
    expect(workforce).toContain('!targetUser.isActive || targetUser.isSuspended || targetUser.isBanned')
  })

  it('blocks restricted accounts from assignment detail and worker-assignment reads', () => {
    const detail = read('app/api/mobile/company/assignments/[id]/route.ts')
    const workerList = read('app/api/mobile/worker/assignments/route.ts')

    expect(detail).toContain('const blocked = assertNotSuspended(user)')
    expect(workerList).toContain('const blocked = assertNotSuspended(user)')
  })
})
