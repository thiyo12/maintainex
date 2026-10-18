import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// These DB-backed suites generate workspaces indirectly in company work-start
// flows. Prisma has no FK protecting workspace.jobId, so parent-first teardown
// silently leaves orphaned rows that the release gate must (and does) reject.
describe('Phase 11 — company assignment fixture workspace integrity', () => {
  for (const path of [
    'tests/jobs/acceptance-gates.test.ts',
    'tests/jobs/closure-gates.test.ts',
  ]) {
    it(`${path} removes dependent workspaces before deleting fixture jobs`, () => {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8')
      const teardown = source.slice(source.indexOf('afterAll(async () => {'))
      expect(teardown).not.toBe(source)
      const deleteWorkspace = teardown.indexOf('prisma.jobWorkspace.deleteMany')
      const deleteJobs = teardown.indexOf('prisma.marketplaceJob.deleteMany')
      expect(deleteWorkspace).toBeGreaterThan(-1)
      expect(deleteJobs).toBeGreaterThan(deleteWorkspace)
      // Avoid making failed workspace cleanup look successful.
      expect(teardown.slice(deleteWorkspace, teardown.indexOf('\n', deleteWorkspace)))
        .not.toContain('.catch(')
    })
  }
})
