/**
 * A second, independent fail-closed boundary for Phase04 witness recording.
 * Even an explicitly opted-in nonproduction process must not accidentally
 * write witness evidence to a shared staging or live database.
 *
 * Deliberately limits this unfinished flow to the named disposable local
 * PostgreSQL integration fixture. No application configuration is changed.
 * A localhost proxy can still point elsewhere, so this is defense in depth,
 * NOT an assurance that a database is safe or permission to activate the API.
 */
export function isPhase04CrewWitnessIsolatedTestEnvironment(): boolean {
  if (process.env.NODE_ENV === 'production' ||
      process.env.MAINTAINEX_PHASE04_CREW_WITNESS_TEST_ENABLED !== 'true') {
    return false
  }
  const value = process.env.DATABASE_URL
  if (!value || value.length > 2048) return false
  try {
    const parsed = new URL(value)
    if (!['postgresql:', 'postgres:'].includes(parsed.protocol) ||
        !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
        parsed.pathname !== '/maintainex_test_phase07_ci' ||
        (parsed.port !== '' && parsed.port !== '5432') ||
        parsed.hash !== '' || !parsed.username || !parsed.password) {
      return false
    }
    // Host, schema and service overrides can redirect a PostgreSQL URI
    // even when its visible hostname and database path look innocuous.
    // The isolated fixture uses default public schema only.
    for (const [key, val] of parsed.searchParams) {
      if (key !== 'schema' || val !== 'public') return false
    }
    if (parsed.searchParams.getAll('schema').length > 1) return false
    return true
  } catch {
    return false
  }
}
