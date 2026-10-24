import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Phase 11 — workforce acceptance fixture integrity', () => {
  it('cleans orphan-prone workspace rows and quotes before parent jobs', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'tests/security/workforce-security.test.ts'),
      'utf8',
    )
    const teardown = source.slice(
      source.indexOf('afterAll(async () => {'),
      source.indexOf('beforeEach(async () => {'),
    )
    const workspace = teardown.indexOf('prisma.jobWorkspace.deleteMany')
    const quotes = teardown.indexOf('prisma.jobQuote.deleteMany')
    const jobs = teardown.indexOf('prisma.marketplaceJob.deleteMany')
    const users = teardown.indexOf('prisma.user.deleteMany')
    expect(workspace).toBeGreaterThan(-1)
    expect(quotes).toBeGreaterThan(workspace)
    expect(jobs).toBeGreaterThan(quotes)
    expect(users).toBeGreaterThan(jobs)
    expect(teardown.slice(workspace, jobs)).not.toContain('.catch(')
  })
})
