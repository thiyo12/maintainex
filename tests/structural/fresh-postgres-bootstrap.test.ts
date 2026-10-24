import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const bootstrap = readFileSync(resolve(root, 'scripts/bootstrap-fresh-database.sh'), 'utf8')
const workflow = readFileSync(resolve(root, '.github/workflows/phase0-7-validation.yml'), 'utf8')

describe('fresh PostgreSQL baseline safety', () => {
  it('refuses databases with public relations or existing Prisma history', () => {
    expect(bootstrap).toContain("c.relkind IN ('r','p','v','m','S','f')")
    expect(bootstrap).toContain('to_regclass(')
    expect(bootstrap).toContain('_prisma_migrations')
    expect(bootstrap).toContain("[[ \"$EMPTY_STATE\" == '0:false' ]]")
    expect(bootstrap).not.toContain('SKIP_BASELINE_SQL')
  })

  it('installs the current schema and raw PostgreSQL invariants before baselining history', () => {
    const schemaApplied = bootstrap.indexOf('psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$TEMP_DIR/baseline.sql"')
    const invariantsApplied = bootstrap.indexOf('psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$INVARIANTS_FILE"')
    const historyResolved = bootstrap.indexOf('prisma migrate resolve --applied')
    expect(schemaApplied).toBeGreaterThanOrEqual(0)
    expect(invariantsApplied).toBeGreaterThan(schemaApplied)
    expect(historyResolved).toBeGreaterThan(invariantsApplied)
    expect(bootstrap).not.toMatch(/migrate resolve[^\n]*(\|\| true|grep)/)
  })

  it('uses the same verified bootstrap procedure in blocking GitHub CI', () => {
    expect(workflow).toContain('run: bash scripts/bootstrap-fresh-database.sh')
    expect(workflow).not.toContain('migrate resolve --applied "$name"')
  })
})
