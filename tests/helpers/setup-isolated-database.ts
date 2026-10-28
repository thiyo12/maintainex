import { assertIsolatedTestDatabase } from './test-guard'

// Runs before importing application/Prisma modules, including suites whose
// historical local guards only looked for "test" anywhere in the URI.
if (process.env.DATABASE_URL) assertIsolatedTestDatabase(process.env.DATABASE_URL)
if (process.env.TEST_DB_URL) {
  assertIsolatedTestDatabase(process.env.TEST_DB_URL)
  if (process.env.TEST_DB_URL !== process.env.DATABASE_URL) {
    throw new Error('TEST DATABASE BLOCKED: TEST_DB_URL and DATABASE_URL disagree')
  }
}
