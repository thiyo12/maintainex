import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { LAUNCH_MARKETS } from '@/lib/geography/market-engine'

const source = readFileSync(
  resolve(process.cwd(), 'scripts/international-provider-coverage-audit.sh'), 'utf8',
)

describe('Phase 11 — aggregate-only provider coverage audit', () => {
  it('covers exactly the 25 launch districts in Sri Lanka', () => {
    const districts = [...source.matchAll(/\('LK','([^']+)'\)/g)].map(match => match[1])
    expect(districts).toHaveLength(25)
    expect(new Set(districts)).toEqual(new Set(LAUNCH_MARKETS.LK.districts))
  })

  it('includes Vancouver and excludes other Canadian municipalities', () => {
    expect(source).toContain("('CA','Vancouver')")
    expect(source).not.toContain("('CA','Burnaby')")
    expect(source).not.toContain("('CA','Richmond')")
  })

  it('requires independent credentials and enforces a read-only transaction', () => {
    expect(source).toContain('MAINTAINEX_READONLY_DATABASE_URL')
    expect(source).toContain('refusing DATABASE_URL')
    expect(source).toContain('default_transaction_read_only=on')
    expect(source).toContain('BEGIN TRANSACTION READ ONLY;')
  })

  it('executes only aggregate SELECT statements and no writes', () => {
    const sql = source.split("<<'SQL'")[1] || ''
    expect(sql).not.toMatch(/\b(?:UPDATE|INSERT|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b/i)
    expect(sql).toContain('COUNT(DISTINCT a.provider_id)')
    expect(sql).toContain('GROUP BY')
    expect(sql).toContain('individual_radius_count')
    expect(sql).toContain('company_radius_count')
    expect(sql).not.toMatch(/\bu\.(?:email|name|phone)\b/i)
  })

  it('excludes restricted accounts and requires verified services and owners', () => {
    expect((source.match(/u\."isActive" = TRUE/g) || [])).toHaveLength(2)
    expect((source.match(/u\."isSuspended" = FALSE/g) || [])).toHaveLength(2)
    expect((source.match(/u\."isBanned" = FALSE/g) || [])).toHaveLength(2)
    expect((source.match(/"verificationStatus" = 'VERIFIED'/g) || [])).toHaveLength(2)
    expect(source).toContain('u."identityStatus" =')
    expect(source).toContain("tm.role = 'COMPANY_OWNER' AND tm.status = 'ACTIVE'")
  })

  it('does not count serialized empty capability arrays as eligible services', () => {
    // A nonempty comma between empty JSON strings must not pass eligibility.
    for (const empty of ['[]', '[""]', '["",""]', '[" ", " "]']) {
      const normalized = empty.replace(/[\[\]"{}]/g, '').split(',')
      expect(normalized.some(token => token.trim().length > 0)).toBe(false)
    }
    const sql = source.split("<<'SQL'")[1] || ''
    expect(sql).not.toContain("btrim(translate(COALESCE(t.skills")
    expect(sql).not.toContain("btrim(translate(COALESCE(c.services")
    expect((sql.match(/AS capability\(token\)/g) || [])).toHaveLength(2)
    expect((sql.match(/WHERE btrim\(capability.token\) <> ''/g) || [])).toHaveLength(2)
  })

  it('distinguishes explicit area coverage from radius-based eligibility', () => {
    expect(source).toContain('District counts measure EXPLICIT named service-area declarations only.')
    expect(source).toContain('NOT proof of geospatial matchability')
    expect(source).toContain('regexp_split_to_table')
  })
  it('executes the aggregate SQL under a separate read-only user in isolated CI PostgreSQL', () => {
    const workflow = readFileSync(
      resolve(process.cwd(), '.github/workflows/phase0-7-validation.yml'), 'utf8',
    )
    expect(workflow).toContain('Phase 11 aggregate provider coverage query (isolated read-only CI DB)')
    expect(workflow).toContain("'@localhost:5432/maintainex_test_phase07_ci'")
    expect(workflow).toContain('CREATE ROLE phase11_coverage_auditor')
    expect(workflow).toContain('GRANT SELECT ON ALL TABLES IN SCHEMA public')
    expect(workflow).toContain('bash scripts/international-provider-coverage-audit.sh')
    expect(workflow).toContain('28 rows')
    expect(workflow).toContain('Upload Phase 11 coverage SQL diagnostics')
  })
})
