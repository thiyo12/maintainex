import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
const src = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const migration = src('prisma/migrations/20261020090000_phase04_crew_presence_witness_scaffold/migration.sql')
const schema = src('prisma/schema.prisma')
const workflow = src('.github/workflows/phase0-7-validation.yml')

describe('Phase04 inert per-member witness schema and CI parity', () => {
  it('uses additive restricted FK-backed evidence and one slot per crew epoch', () => {
    expect(migration).toContain('CREATE TABLE "CompanyCrewPresenceWitness"')
    expect(migration).toContain('CREATE UNIQUE INDEX "CrewPresenceWitness_scope_key"')
    expect(migration).toContain('CHECK ("crewVersion" >= 1)')
    expect(migration).toContain('"workerAttestedAt" IS NOT NULL OR "customerAttestedAt" IS NOT NULL')
    expect(migration).toContain('ON DELETE RESTRICT')
    expect(schema).toContain('model CompanyCrewPresenceWitness {')
    expect(schema).toContain('@@unique([crewDispatchId, crewVersion, assignmentId]')
    expect(schema).toContain('crewPresenceWitnesses CompanyCrewPresenceWitness[]')
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE)\s+(?:TABLE|INDEX|FROM)/i)
  })
  it('restores custom witness constraints when CI bootstraps from Prisma baseline', () => {
    expect(workflow).toContain('ADD CONSTRAINT "CrewPresenceWitness_positive_epoch_check"')
    expect(workflow).toContain('ADD CONSTRAINT "CrewPresenceWitness_nonempty_check"')
    expect(workflow).toContain('CHECK ("crewVersion" >= 1)')
    expect(workflow).toContain('"workerAttestedAt" IS NOT NULL OR "customerAttestedAt" IS NOT NULL')
  })
  it('preserves single-worker PIN and permission guards with no live presence grant', () => {
    const pin = src('lib/domain/job-pin.ts')
    expect(pin).toContain('Multi-worker jobs require crew-specific PIN verification')
    const domain = src('lib/domain/company-crew-presence-witness.ts')
    expect(domain).toContain('physicalPresenceVerified: false')
    expect(domain).toContain('arrivalEnabled: false')
    expect(domain).toContain('workStartEnabled: false')
    expect(domain).not.toContain('tx.companyCrewPresenceWitness.create')
    expect(domain).not.toContain('tx.companyCrewDispatch.update')
  })
})
