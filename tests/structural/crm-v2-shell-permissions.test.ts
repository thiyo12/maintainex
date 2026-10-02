import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM V2 shell permission language', () => {
  it('uses canonical V2 permissions in primary navigation', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'components/admin/AdminLayout.tsx'),
      'utf8'
    )

    for (const permission of [
      'dashboard:view',
      'jobs:view',
      'customers:view',
      'taskers:view',
      'companies:view',
      'finance:payments:view',
      'disputes:view',
      'risk:view',
      'audit:view',
      'markets:view',
      'staff:view',
    ]) {
      expect(source).toContain(permission)
    }

    for (const retiredAlias of [
      'users:view',
      'wallets:view',
      'commission:view',
      'kyc:view',
      'risk_events:read',
      'audit:read',
      'market_config:read',
      'admins:view',
    ]) {
      expect(source).not.toContain(retiredAlias)
    }
  })
})
