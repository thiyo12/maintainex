import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const migration = source('prisma/migrations/20261020010000_phase04_crew_member_pin_challenge/migration.sql')
const schema = source('prisma/schema.prisma')

describe('Phase04 crew member challenge persistence remains inert and scoped', () => {
  it('stores only digest, exact crew/member epoch, purpose and expiry, not plaintext', () => {
    expect(schema).toContain('model CompanyCrewPinChallenge {')
    for (const col of [
      'crewDispatchId', 'assignmentId', 'jobId', 'crewVersion',
      'challengeVersion', 'pinDigest', 'issuedByCustomerUserId',
      'expiresAt', 'failedAttempts', 'lockedUntil', 'consumedAt', 'revokedAt',
    ]) {
      expect(schema).toContain(col)
      expect(migration).toContain('"' + col + '"')
    }
    expect(schema).not.toContain('plaintextPin')
    expect(migration).toContain('CrewPinChallenge_scope_version_key')
    const bootstrapInvariants = source('prisma/bootstrap/postgresql-invariants.sql')
    // The release gate uses the shared fresh-database bootstrap; keep raw
    // indexes and checks in its reviewed invariant bundle.
    expect(migration).toContain('CREATE UNIQUE INDEX "CrewPinChallenge_one_live_idx"')
    expect(bootstrapInvariants).toContain('CREATE UNIQUE INDEX "CrewPinChallenge_one_live_idx"')
    expect(bootstrapInvariants).toContain('WHERE "consumedAt" IS NULL AND "revokedAt" IS NULL')
    expect(migration).toContain('"purpose" IN (\'ARRIVAL\', \'WORK_START\')')
    expect(migration).toContain('"pinDigest" ~ \'^[a-f0-9]{64}$\'')
    expect(migration).toContain('"failedAttempts" BETWEEN 0 AND 5')
    // Prisma's baseline cannot express CHECK constraints. A green baseline
    // must enforce every raw migration check as well as the partial index.
    const pinChecks = [
      ['CompanyCrewPinChallenge_epoch_check', '"crewVersion" >= 1 AND "challengeVersion" >= 1'],
      ['CompanyCrewPinChallenge_purpose_check', '"purpose" IN (\'ARRIVAL\', \'WORK_START\')'],
      ['CompanyCrewPinChallenge_attempt_check', '"failedAttempts" BETWEEN 0 AND 5'],
      ['CompanyCrewPinChallenge_digest_check', '"pinDigest" ~ \'^[a-f0-9]{64}$\''],
      ['CompanyCrewPinChallenge_expiry_check', '"expiresAt" > "createdAt"'],
      ['CompanyCrewPinChallenge_terminal_check', '"consumedAt" IS NULL OR "revokedAt" IS NULL'],
    ] as const
    for (const [name, expression] of pinChecks) {
      expect(migration).toContain('"' + name + '"')
      expect(bootstrapInvariants).toContain('"' + name + '"')
      expect(bootstrapInvariants).toContain('CHECK (' + expression + ')')
    }
  })

  it('only adds a constrained table without weakening old unique assignment/PIN guards', () => {
    expect(migration).toContain('CREATE TABLE "CompanyCrewPinChallenge"')
    expect(migration).not.toMatch(/\b(?:DROP\s+(?:TABLE|INDEX|COLUMN|CONSTRAINT)|DELETE\s+FROM|TRUNCATE\s+TABLE)\b/i)
    expect(migration).not.toMatch(/\bUPDATE\s+"MarketplaceJob"\b/i)
    expect(migration).toContain('ON DELETE RESTRICT')
    const legacy = source('lib/domain/job-pin.ts')
    expect(legacy.split('if ((job.workersCount ?? 1) !== 1)').length - 1).toBe(3)
    expect(legacy).toContain('Multi-worker jobs require crew-specific PIN verification')
    const guard = source('lib/domain/company-crew-barrier.ts')
    expect(guard).toContain('workStartEnabled: false')
  })

  it('does not wire PIN issuance or verification to public crew routes', () => {
    for (const path of [
      'app/api/mobile/worker/crew/route.ts',
      'app/api/mobile/company/crew/roster/route.ts',
      'app/api/mobile/company/crew/evidence/route.ts',
    ]) {
      const route = source(path)
      expect(route).not.toContain('companyCrewPinChallenge.create')
      expect(route).not.toContain('deriveCrewPinDigest')
      expect(route).not.toContain('matchesCrewPinDigest')
    }
  })
})
