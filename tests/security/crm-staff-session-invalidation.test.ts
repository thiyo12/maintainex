import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM staff privilege-change session invalidation', () => {
  it('revokes target staff sessions inside the permission-change transaction', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/admins/[id]/permissions/route.ts'),
      'utf8'
    )

    expect(source).toContain('tx.adminSession.updateMany')
    expect(source).toContain('adminUserId: id')
    expect(source).toContain('isRevoked: true')
    expect(source.indexOf('tx.adminSession.updateMany')).toBeLessThan(
      source.indexOf('tx.securityAudit.create')
    )
  })
})
