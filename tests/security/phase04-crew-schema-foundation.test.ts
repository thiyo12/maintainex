import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const migration = source('prisma/migrations/20261019010000_phase04_crew_lifecycle_scaffold/migration.sql')
const schema = source('prisma/schema.prisma')

describe('Phase 04 — crew lifecycle schema foundation is additive, not dispatch enablement', () => {
  it('stores versioned roster metadata and per-worker identity/arrival evidence separately from legacy jobs', () => {
    expect(schema).toContain('model CompanyCrewDispatch {')
    expect(schema).toMatch(/requiredWorkersCount\s+Int/)
    expect(schema).toMatch(/crewDispatch\s+CompanyCrewDispatch\?/)
    expect(schema).toMatch(/crewDispatchId\s+String\?/)
    expect(schema).toMatch(/crewIdentityConfirmedAt\s+DateTime\?/)
    expect(migration).toContain('CREATE TABLE "CompanyCrewDispatch"')
    expect(migration).toContain('"requiredWorkersCount" BETWEEN 2 AND 12')
    expect(migration).toContain('"version" >= 1')
    expect(migration).toContain('"crewSlot" BETWEEN 1 AND 12')
    expect(migration).toContain('CompanyJobAssignment_crewDispatchId_crewSlot_key')
  })

  it('preserves legacy assignments, the one-active-worker index and crew PIN/work-start barriers', () => {
    expect(migration).toContain('ALTER TABLE "CompanyJobAssignment"')
    expect(migration).not.toMatch(/\\bDROP\\s+(?:TABLE|INDEX|COLUMN|CONSTRAINT)\\b/i)
    expect(migration).not.toMatch(/\\bDELETE\\s+FROM\\b/i)
    expect(migration).not.toMatch(/\\bUPDATE\\s+"MarketplaceJob"\\b/i)
    expect(source('prisma/migrations/20260913010000_phase10_7_active_assignment_unique/migration.sql'))
      .toContain('CompanyJobAssignment_active_per_job_idx')
    const dispatch = source('lib/domain/company-job-assignment.ts')
    expect(dispatch).toContain('workersCount: 1')
    expect(source('lib/domain/job-pin.ts')).toContain('Multi-worker jobs require crew-specific PIN verification')
  })
})
