const url = process.env.DATABASE_URL || ''

function extractDbName(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl)
    return parsed.pathname.replace(/^\//, '')
  } catch {
    const match = databaseUrl.match(/\/([^/?]+)(\?|$)/)
    return match ? match[1] : ''
  }
}

const PRODUCTION_DB_NAMES = ['maintainex']

export function assertNotProductionDb(): void {
  if (!url.includes('postgresql')) return
  const dbName = extractDbName(url)
  if (PRODUCTION_DB_NAMES.includes(dbName)) {
    throw new Error(
      `FINANCIAL TEST BLOCKED: DATABASE_URL points to production database "${dbName}". ` +
      `Financial mutation tests must use an isolated test database (e.g. maintainex_phase5_test). ` +
      `Set DATABASE_URL to a non-production database name to proceed.`
    )
  }
}

export function isTestDatabase(): boolean {
  const dbName = extractDbName(url)
  return url.includes('postgresql') && !PRODUCTION_DB_NAMES.includes(dbName)
}

export const isPostgres = url.includes('postgresql')
