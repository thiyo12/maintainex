import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROLE_PERMISSIONS } from '@/lib/admin-types'

describe('CRM V2 staff session control', () => {
  it('uses canonical staff:view for the directory and activity surfaces', () => {
    const directory = readFileSync(resolve(process.cwd(), 'app/api/admin/admins/route.ts'), 'utf8')
    const activity = readFileSync(resolve(process.cwd(), 'app/api/admin/staff/activity/route.ts'), 'utf8')

    expect(directory).toContain("permission: 'staff:view'")
    expect(activity).toContain("permission: 'staff:view'")
    expect(directory).not.toContain("permission: 'admins:view'")
    expect(activity).not.toContain("permission: 'admins:view'")
    expect(ROLE_PERMISSIONS.MANAGER).toContain('staff:view')
  })

  it('never exposes staff session token material', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/api/admin/staff/sessions/route.ts'), 'utf8')

    expect(source).not.toContain('refreshTokenHash')
    expect(source).not.toContain('tokenFamilyId')
    expect(source).toContain('ipAddress: true')
    expect(source).toContain('userAgent: true')
  })

  it('uses governed revocation with owner protection and atomic audit', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/api/admin/staff/sessions/route.ts'), 'utf8')

    expect(source).toContain("guardCrmAction(request, 'staff.session.revoke')")
    expect(source).toContain("targetAdmin.role === 'SUPER_ADMIN' && security.role !== 'SUPER_ADMIN'")
    expect(source).toContain('prisma.$transaction')
    expect(source).toContain('tx.adminSession.update')
    expect(source).toContain('tx.securityAudit.create')
    expect(source).toContain("action: 'STAFF_SESSION_REVOKE'")
  })
})
