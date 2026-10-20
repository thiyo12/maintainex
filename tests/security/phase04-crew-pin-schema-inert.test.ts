import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const schema = read('prisma/schema.prisma')
const migration = read('prisma/migrations/20261020090000_phase04_crew_epoch_pin_scaffold/migration.sql')

describe('Phase 04 — versioned crew challenge persistence is additive and never active', () => {
  it('models separate crew-epoch and per-worker challenges with short TTL and hashed PINs', () => {
    expect(schema).toContain('model CompanyCrewPinChallenge {')
    expect(schema).toContain('crewVersion      Int')
    expect(schema).toContain('pinHash          String')
    expect(schema).toContain('assignmentId     String?')
    expect(migration).toContain('"purpose" = \'ARRIVAL\' AND "assignmentId" IS NOT NULL')
    expect(migration).toContain('"purpose" = \'WORK_START\' AND "assignmentId" IS NULL')
    expect(migration).toContain("INTERVAL '10 minutes'")
    expect(migration).toContain('"failedAttempts" BETWEEN 0 AND 5')
  })

  it('enforces both nullable group and worker uniqueness under PostgreSQL', () => {
    expect(migration).toContain('CompanyCrewPinChallenge_worker_epoch_key')
    expect(migration).toContain('CompanyCrewPinChallenge_group_epoch_key')
    expect(migration).toContain('WHERE "assignmentId" IS NOT NULL')
    expect(migration).toContain('WHERE "assignmentId" IS NULL')
    expect(migration).toContain('ON DELETE RESTRICT')
  })

  it('restores raw challenge constraints in the isolated CI baseline before database tests', () => {
    const workflow = read('.github/workflows/phase0-7-validation.yml')
    expect(workflow).toContain('psql "$DATABASE_URL" -v ON_ERROR_STOP=1')
    expect(workflow).toContain('CompanyCrewPinChallenge_group_epoch_key')
    expect(workflow).toContain('CompanyCrewPinChallenge_worker_epoch_key')
    for (const constraint of [
      'CompanyCrewPinChallenge_version_check',
      'CompanyCrewPinChallenge_shape_check',
      'CompanyCrewPinChallenge_status_check',
      'CompanyCrewPinChallenge_attempts_check',
      'CompanyCrewPinChallenge_window_check',
      'CompanyCrewPinChallenge_consumed_check',
      'CompanyCrewPinChallenge_revoked_check',
    ]) {
      expect(migration).toContain(constraint)
      expect(workflow).toContain(constraint)
    }
    expect(workflow).toContain('WHERE "assignmentId" IS NULL')
    expect(workflow).toContain("INTERVAL '10 minutes'")
  })

  it('preserves all legacy data, indexes and existing crew start/pin denials', () => {
    expect(migration).toContain('CREATE TABLE "CompanyCrewPinChallenge"')
    expect(migration).not.toMatch(/\bDROP\s+(?:TABLE|INDEX|COLUMN|CONSTRAINT)\b/i)
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i)
    expect(migration).not.toMatch(/\bUPDATE\s+"MarketplaceJob"\b/i)
    expect(read('lib/domain/job-pin.ts')).toContain('Multi-worker jobs require crew-specific PIN verification')
    expect(read('lib/domain/company-crew-barrier.ts')).toContain('workStartEnabled: false')
  })
})
