import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const paths = [
  'tests/finance/payments/cancellation-payment-postgres.test.ts',
  'tests/finance/payments/payment-intent-concurrency-postgres.test.ts',
]
describe('Phase 11 — payment PostgreSQL fixtures cannot orphan workspaces on teardown', () => {
  for (const path of paths) {
    it(`${path} deletes dependent workspaces before parent jobs`, () => {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8')
      const teardown = source.slice(source.indexOf('afterAll(async () => {'))
      const workspace = teardown.indexOf('prisma.jobWorkspace.deleteMany({ where: { jobId } })')
      const quote = teardown.indexOf('prisma.jobQuote.deleteMany')
      const job = teardown.indexOf('prisma.marketplaceJob.deleteMany')
      expect(workspace).toBeGreaterThan(-1)
      expect(quote).toBeGreaterThan(workspace)
      expect(job).toBeGreaterThan(quote)
      expect(teardown).not.toContain('DELETE FROM "JobWorkspace"')
    })
  }
})
