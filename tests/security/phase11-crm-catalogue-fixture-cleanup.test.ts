import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(),
  'tests/security/crm-canonical-catalog.test.ts'), 'utf8')

describe('Phase 11 — CRM catalogue fixtures stay inside the test boundary', () => {
  it('deletes fixture jobs using the tracked parent category IDs', () => {
    expect(source).toContain('created.push(c.id)')
    expect(source).toContain('categoryId: { in: created }')
    expect(source).not.toContain('templateJob.deleteMany({ where: { id: { in: created } } })')
  })

  it('deletes child template jobs before its own category fixtures', () => {
    const jobs = source.indexOf('await prisma.templateJob.deleteMany(')
    const categories = source.indexOf('await prisma.jobCategory.deleteMany(')
    expect(jobs).toBeGreaterThan(0)
    expect(categories).toBeGreaterThan(jobs)
    expect(source).toContain('startsWith:')
    expect(source).toContain('crmtest-')
  })

  it('keeps inactive-by-default catalogue and market-scope guards', () => {
    expect(source).toContain('expect(res.body.templateJob.isActive).toBe(false)')
    expect(source).toContain('expect(patch.status).toBe(403)')
  })
})
