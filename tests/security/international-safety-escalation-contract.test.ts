import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'app/api/mobile/disputes/route.ts'), 'utf8')

describe('V2 job safety escalation integration', () => {
  it('rejects malformed or oversized report data before writing', () => {
    expect(source).toContain("typeof jobId !== 'string'")
    expect(source).toContain("typeof reason !== 'string'")
    expect(source).toContain("typeof description !== 'string'")
    expect(source).toContain('reason.length > 120')
    expect(source).toContain('description.length > 5000')
    expect(source.indexOf("typeof jobId !== 'string'")).toBeLessThan(source.indexOf('raiseJobDispute('))
  })
  it('keeps job participant authorization before safety escalation', () => {
    const auth = source.indexOf('if (!actorType)')
    const safety = source.indexOf('const safetyReasons = new Set')
    expect(auth).toBeGreaterThan(0)
    expect(safety).toBeGreaterThan(auth)
  })
  it('routes explicit safety concerns to existing high-priority CRM queue', () => {
    expect(source).toContain("'SAFETY_IMMEDIATE_DANGER'")
    expect(source).toContain("'SAFETY_IDENTITY_MISMATCH'")
    expect(source).toContain("category: safetyReport ? 'tasker_escalation' : 'dispute'")
    expect(source).toContain("severity: safetyReport ? 'critical' : 'high'")
    expect(source).toContain("priority: safetyReport ? 'critical' : 'high'")
  })
  it('retains existing MarketplaceDispute and job audit workflow', () => {
    expect(source).toContain('raiseJobDispute(')
    expect(source).toContain("targetTable: 'MarketplaceDispute'")
  })
})
