import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isPhase04CrewWitnessIsolatedTestEnvironment as allowed } from '@/lib/domain/company-crew-witness-isolated-db'

const base = 'postgresql://isolated_user:local_password@127.0.0.1:5432/maintainex_test_phase07_ci'

describe('Phase04 crew witness environment: defense-in-depth local database isolation', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('MAINTAINEX_PHASE04_CREW_WITNESS_TEST_ENABLED', 'true')
    vi.stubEnv('DATABASE_URL', base)
  })
  afterEach(() => vi.unstubAllEnvs())

  it('permits only explicitly enabled nonproduction named local isolated fixtures', () => {
    expect(allowed()).toBe(true)
    for (const url of [
      'postgres://isolated_user:local_password@localhost:5432/maintainex_test_phase07_ci',
      base + '?schema=public',
      'postgresql://isolated_user:local_password@[::1]:5432/maintainex_test_phase07_ci',
    ]) {
      vi.stubEnv('DATABASE_URL', url)
      expect(allowed()).toBe(true)
    }
  })

  it('fails closed in production even if the feature flag and fixture are supplied', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(allowed()).toBe(false)
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('MAINTAINEX_PHASE04_CREW_WITNESS_TEST_ENABLED', 'false')
    expect(allowed()).toBe(false)
    vi.stubEnv('MAINTAINEX_PHASE04_CREW_WITNESS_TEST_ENABLED', '')
    expect(allowed()).toBe(false)
  })

  it.each([
    'postgresql://isolated_user:local_password@localhost.evil.example:5432/maintainex_test_phase07_ci',
    'postgresql://isolated_user:local_password@localhost:5432/maintainex_prod',
    'postgresql://isolated_user:local_password@localhost:5432/maintainex_test_phase07_ci?schema=prod',
    'postgresql://isolated_user:local_password@localhost:5432/maintainex_test_phase07_ci?schema=public&schema=public',
    'postgresql://isolated_user:local_password@localhost:5432/maintainex_test_phase07_ci?options=-csearch_path%3Dprod',
    'postgresql://isolated_user:local_password@localhost:5432/maintainex_test_phase07_ci?host=db.remote',
    'postgresql://isolated_user:local_password@localhost:9999/maintainex_test_phase07_ci',
    'postgresql://isolated_user:local_password@localhost:5432/maintainex_test_phase07_ci#malformed',
    'postgresql://isolated_user@localhost:5432/maintainex_test_phase07_ci',
    'postgresql://localhost:5432/maintainex_test_phase07_ci',
    'file:./dev.db',
    '',
    'not-a-uri',
    base + 'x'.repeat(2049),
  ])('rejects production-like or malformed database fixture %s', db => {
    vi.stubEnv('DATABASE_URL', db)
    expect(allowed()).toBe(false)
  })
})
