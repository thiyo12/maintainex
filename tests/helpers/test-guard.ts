const url = process.env.DATABASE_URL || ''

/** Never authorize mutation tests from a substring in a URI or a denylist. */
export function assertIsolatedTestDatabase(databaseUrl: string): void {
  let parsed: URL
  try { parsed = new URL(databaseUrl) } catch { throw new Error('TEST DATABASE BLOCKED: invalid database URL') }
  const name = parsed.pathname.slice(1)
  if (!['postgresql:', 'postgres:'].includes(parsed.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
      !/^maintainex_[a-z0-9_]*(?:test|ci)(?:_[a-z0-9_]+)?$/i.test(name) || parsed.hash) {
    throw new Error('TEST DATABASE BLOCKED: requires an explicitly named disposable local PostgreSQL database')
  }
  for (const [key, value] of parsed.searchParams) {
    if (!['schema', 'connection_limit', 'pool_timeout'].includes(key) ||
        (key === 'schema' && value !== 'public') ||
        (key !== 'schema' && !/^\d+$/.test(value)) ||
        parsed.searchParams.getAll(key).length !== 1) {
      throw new Error('TEST DATABASE BLOCKED: unsafe database connection override')
    }
  }
}

export function assertNotProductionDb(): void {
  if (url) assertIsolatedTestDatabase(url)
}

export function isTestDatabase(): boolean {
  try { assertIsolatedTestDatabase(url); return true } catch { return false }
}

export const isPostgres = /^postgres(?:ql)?:\/\//.test(url)

export function requiresPostgres(): boolean {
  return isPostgres && isTestDatabase()
}
