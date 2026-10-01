import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('company assignment lifecycle boundary', () => {
  it('moves a company-level target to the selected worker on first assignment', () => {
    const domain = read('lib/domain/company-job-assignment.ts')

    expect(domain).toContain("{ targetTaskerId: companyId }")
    expect(domain).toContain("{ targetTaskerId: companyIdentity.userId }")
    expect(domain).toContain('data: { targetTaskerId: workerUserId }')
  })

  it('restores the company target when a worker rejects or is revoked before start', () => {
    const domain = read('lib/domain/company-job-assignment.ts')

    expect(domain).toContain('data: { targetTaskerId: assignment.companyId }')
    expect(domain).toContain('data: { targetTaskerId: companyId }')
    expect(domain).toContain('Job target changed before assignment rejection')
    expect(domain).toContain('Job target changed before assignment revocation')
  })

  it('requires an accepted worker assignment before company work can start via PIN', () => {
    const pin = read('lib/domain/job-pin.ts')

    expect(pin).toContain("status: 'ACCEPTED'")
    expect(pin).toContain("data: { status: 'IN_PROGRESS', startedAt: now }")
    expect(pin).toContain('Only the accepted assigned company worker can start work')
  })

  it('serializes worker scheduling and reassignment races', () => {
    const domain = read('lib/domain/company-job-assignment.ts')

    expect(domain).toContain('async function lockAndAssertWorkerScheduleAvailable')
    expect(domain).toContain('FOR UPDATE')
    expect(domain).toContain('Worker scheduling conflict changed concurrently')
    expect(domain).toContain('targetTaskerId: currentAssignment.workerUserId')
    expect(domain).toContain("status: { in: ['ASSIGNED', 'ACCEPTED'] }")
    expect(domain).toContain("throw new Error('Job target changed before reassignment')")
    expect(domain).toContain("throw new Error('Assignment changed before reassignment')")
  })

  it('maps assignment state races to HTTP 409 instead of generic failures', () => {
    const route = read('app/api/mobile/company/assign/route.ts')

    expect(route).toContain("message.includes('concurrently')")
    expect(route).toContain("message.includes('scheduling conflict')")
    expect(route).toContain('{ status: isConflict ? 409 : 400 }')
  })

  it('aligns assignment detail reads with the workers:read permission', () => {
    const route = read('app/api/mobile/company/assignments/[id]/route.ts')

    expect(route).toContain("hasCompanyPermission(membership.role as CompanyRole, 'workers:read')")
    expect(route).toContain('const canReadAssignment =')
    expect(route).toContain('if (!canReadAssignment)')
  })
})
