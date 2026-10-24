import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const market = readFileSync(resolve(process.cwd(), 'tests/security/phase03-market-isolation-postgres.test.ts'), 'utf8')
const visibility = readFileSync(resolve(process.cwd(), 'tests/security/provider-profile-visibility-postgres.test.ts'), 'utf8')

describe('Phase 11 — market isolation fixtures preserve referential integrity', () => {
  it('removes workspace and quote rows before the parent market job', () => {
    const start = market.indexOf('for (const jobId of created.jobIds)')
    const section = market.slice(start, market.indexOf('await prisma.taskerSkill.deleteMany', start))
    const workspace = section.indexOf('await prisma.jobWorkspace.deleteMany')
    const quote = section.indexOf('await prisma.jobQuote.deleteMany')
    const job = section.indexOf('await prisma.marketplaceJob.deleteMany')
    expect(start).toBeGreaterThan(-1)
    expect(workspace).toBeGreaterThan(-1)
    expect(quote).toBeGreaterThan(workspace)
    expect(job).toBeGreaterThan(quote)
  })
  it('removes payment fixture workspace rows before its job rows', () => {
    const start = market.indexOf('await prisma.jobEscrow.deleteMany({ where: { customerId } })')
    const section = market.slice(start, start + 600)
    const workspace = section.indexOf('await prisma.jobWorkspace.deleteMany')
    const job = section.indexOf('await prisma.marketplaceJob.deleteMany')
    expect(workspace).toBeGreaterThan(-1)
    expect(job).toBeGreaterThan(workspace)
  })
  it('also removes workspaces in provider profile visibility teardown', () => {
    const workspace = visibility.indexOf('await prisma.jobWorkspace.deleteMany')
    const job = visibility.indexOf('await prisma.marketplaceJob.deleteMany')
    expect(workspace).toBeGreaterThan(-1)
    expect(job).toBeGreaterThan(workspace)
  })
})
