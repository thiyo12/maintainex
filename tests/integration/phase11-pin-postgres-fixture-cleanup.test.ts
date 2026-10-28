import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'tests/jobs/job-pin-postgres.test.ts'), 'utf8')
const teardown = source.slice(source.indexOf('  afterAll(async () => {'), source.indexOf('  beforeEach(async () => {'))

describe('Phase 11 — generated-ID PIN fixture teardown', () => {
  it('never runs destructive database tests against an arbitrary PostgreSQL URL', () => {
    expect(source).toContain("DATABASE_URL.includes('maintainex_test')")
    expect(source).toContain("DATABASE_URL.includes('_ci')")
    expect(source).not.toContain("const isPostgres = DATABASE_URL.includes('postgresql')")
  })

  it('deletes all generated bookings and child records before fixture users', () => {
    expect(teardown).toContain('[jobAId, jobBId, workStartJobId]')
    expect(teardown).toContain('[customerAId, customerBId, providerId]')
    const order = [
      'prisma.jobVerificationPin.deleteMany',
      'prisma.jobEscrow.deleteMany',
      'prisma.jobWorkspace.deleteMany',
      'prisma.jobQuote.deleteMany',
      'prisma.marketplaceJob.deleteMany',
      'prisma.user.deleteMany',
    ].map(piece => teardown.indexOf(piece))
    expect(order.every(index => index >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(teardown).not.toContain('.catch(')
    expect(teardown).not.toMatch(/LIKE ['"]%pin-postgres-test%/)
  })

  it('disconnects even when cleanup fails', () => {
    expect(teardown).toContain('} finally {')
    expect(teardown).toContain('await prisma.$disconnect()')
  })
})
