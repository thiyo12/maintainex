import { describe, expect, it } from 'vitest'
import { assertIsolatedTestDatabase } from '../helpers/test-guard'

describe('mutation test database isolation', () => {
  it.each([
    'postgresql://fixture@localhost:55489/maintainex_test_deep_audit',
    'postgresql://fixture@127.0.0.1/maintainex_test_phase07_ci?schema=public',
    'postgres://fixture@[::1]/maintainex_phase5_test',
  ])('accepts dedicated local fixture %s', url => expect(() => assertIsolatedTestDatabase(url)).not.toThrow())

  it.each([
    'postgresql://fixture@db.example/maintainex_test',
    'postgresql://maintainex_test@db.example/postgres',
    'postgresql://fixture@localhost/postgres?application_name=maintainex_test',
    'postgresql://fixture@localhost/maintainex',
    'postgresql://fixture@localhost/maintainex_production',
    'postgresql://fixture@localhost.evil.example/maintainex_test',
    'postgresql://fixture@localhost/maintainex_test?host=db.example',
    'postgresql://fixture@localhost/maintainex_test?options=-csearch_path%3Dprod',
    'postgresql://fixture@localhost/maintainex_test?schema=prod',
    'postgresql://fixture@localhost/maintainex_test?schema=public&schema=public',
    'file:./user.db',
    '',
  ])('refuses ambiguous or unsafe database %s', url => expect(() => assertIsolatedTestDatabase(url)).toThrow('TEST DATABASE BLOCKED'))
})
