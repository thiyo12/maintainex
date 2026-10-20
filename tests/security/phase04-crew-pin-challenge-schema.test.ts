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
    expect(migration).toContain('"purpose" IN (\'ARRIVAL\', \'WORK_START\')')
    expect(migration).toContain('"pinDigest" ~ \'^[a-f0-9]{64}$\'')
    expect(migration).toContain('"failedAttempts" BETWEEN 0 AND 5')
  })

  it('only adds a constrained table without weakening old unique assignment/PIN guards', () => {
    expect(migration).toContain('CREATE TABLE "CompanyCrewPinChallenge"')
    expect(migration).not.toMatch(/\b(DROP|DELETE|TRUNCATE)\b/i)
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
