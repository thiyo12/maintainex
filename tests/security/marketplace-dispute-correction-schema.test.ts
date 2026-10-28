import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const migration = source('prisma/migrations/20261025150000_marketplace_dispute_evidence_corrections/migration.sql')
const bootstrap = source('prisma/bootstrap/postgresql-invariants.sql')

describe('dispute evidence and correction database invariants', () => {
  it('uses additive schema changes and guards evidence/correction history against mutation', () => {
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE)\s+(?:TABLE|INDEX|COLUMN|CONSTRAINT)\b/i)
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i)
    for (const table of ['MarketplaceDisputeEvidence', 'MarketplaceDisputeEvidenceEvent', 'MarketplaceDisputeCorrection', 'MarketplaceDisputeCorrectionEvent']) {
      expect(migration).toContain(`BEFORE UPDATE OR DELETE ON "${table}"`)
      expect(bootstrap).toContain(`BEFORE UPDATE OR DELETE ON "${table}"`)
    }
    expect(migration).toContain('"amountMinor" > 0')
    expect(migration).toContain('"amountWaived" <= "amountOriginal"')
    expect(bootstrap).toContain('"amountWaived" <= "amountOriginal"')
  })
})
