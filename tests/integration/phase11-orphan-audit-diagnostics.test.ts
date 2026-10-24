import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(
  resolve(process.cwd(), 'tests/integration/real-postgresql-integration.test.ts'),
  'utf8',
)
const audit = source.slice(
  source.indexOf("describe.skipIf(!isVPS)('4D.7 — FK/Orphan Audit'"),
  source.indexOf("describe.skipIf(!isVPS)('4D.9 — Authorization Regression'"),
)
describe('Phase 11 — orphan audit remains strict and reports bounded fixture IDs', () => {
  it('keeps the zero-orphan assertions and does not delete evidence', () => {
    expect(audit).toContain("MarketplaceJob.customerId orphans = 0")
    expect(audit).toContain("JobQuote.providerId orphans = 0")
    expect(audit).toContain("JobWorkspace.jobId orphans = 0")
    expect(audit).toContain("expect(Number(count),")
    expect(audit).toContain('.toBe(0)')
    expect(audit).not.toMatch(/\b(?:deleteMany|delete|truncate|DROP|DELETE FROM)\b/i)
  })
  it('reports only bounded, read-only samples for each failing relation', () => {
    expect(audit.match(/ORDER BY [a-z]+\.id LIMIT 25/g)).toHaveLength(3)
    expect(audit).toContain('orphaned fixture IDs')
    expect(audit).not.toContain('LIMIT 0')
  })
})
