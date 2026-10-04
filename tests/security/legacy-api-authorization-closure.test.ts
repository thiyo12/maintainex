import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('legacy API authorization closure', () => {
  const crmOnly = [
    'app/api/users/route.ts',
    'app/api/settings/route.ts',
    'app/api/security/audit/route.ts',
    'app/api/security/suspicious/route.ts',
    'app/api/applications/[id]/route.ts',
    'app/api/invoices/route.ts',
    'app/api/invoices/[id]/route.ts',
    'app/api/invoices/[id]/pdf/route.ts',
    'app/api/services/[id]/route.ts',
    'app/api/reviews/[id]/route.ts',
    'app/api/vacancies/[id]/route.ts',
    'app/api/industries/route.ts',
  ]

  for (const path of crmOnly) {
    it(`${path} does not authorize admin/private actions with legacy getSession`, () => {
      const code = source(path)
      expect(code).toContain('guardCrmRequest(')
      expect(code).not.toContain("from '@/lib/auth/authentication/auth-utils'")
    })
  }

  it('booking collection staff read uses CRM country scope while customer creation keeps ownership-derived user identity', () => {
    const code = source('app/api/bookings/route.ts')
    expect(code).toContain("permission: 'jobs:view'")
    expect(code).toContain('resolveReportBranchScope')
    expect(code).toContain("prisma.user.findUnique({ where: { email: session.email } })")
    expect(code).toContain('where: { id: branchId, region, isActive: true }')
  })

  it('booking detail keeps legacy auth only for own CUSTOMER reads and uses CRM guard for staff mutations', () => {
    const code = source('app/api/bookings/[id]/route.ts')
    expect(code).toContain("legacySession?.role === 'CUSTOMER'")
    expect(code).toContain('booking.userId !== legacySession.id')
    expect(code).toContain("'jobs:view' | 'jobs:manage'")
    expect(code).toContain("authorizeCrmBooking(request, id, 'jobs:manage', 'mutation')")
    expect(code).toContain("authorizeCrmBooking(request, id, 'jobs:manage', 'sensitive')")
    expect(code).toContain('guardCrmRequest(')
    expect(code).toContain('updateMany')
    expect(code).toContain('BOOKING_STATE_CHANGED')
  })

  it('applications keep public submission but CRM-govern all staff reads and mutations', () => {
    const collection = source('app/api/applications/route.ts')
    const detail = source('app/api/applications/[id]/route.ts')
    expect(collection).toContain("permission: 'users:view'")
    expect(collection).toContain('export async function POST')
    expect(detail).toContain("'users:view' | 'users:edit'")
    expect(detail).toContain("authorizeApplication(request, id, 'users:edit', 'mutation')")
    expect(detail).toContain("authorizeApplication(request, id, 'users:edit', 'sensitive')")
    expect(detail).toContain('resolveReportBranchScope')
  })

  it('invoice routes use finance permissions, country scope, whitelisted updates, and no hard-coded bank account', () => {
    const collection = source('app/api/invoices/route.ts')
    const detail = source('app/api/invoices/[id]/route.ts')
    const pdf = source('app/api/invoices/[id]/pdf/route.ts')

    expect(collection).toContain("permission: 'commission:view'")
    expect(collection).toContain("permission: 'commission:manage'")
    expect(collection).toContain('resolveReportBranchScope')
    expect(detail).toContain("for (const key of ['customerName'")
    expect(detail).not.toContain('data: updateData,\n      include')
    expect(pdf).not.toContain('Account: 1234567890')
    expect(pdf).toContain("permission: 'commission:view'")
  })

  it('industry migration is unavailable in production and Cloudinary fetches are host constrained', () => {
    const migrate = source('app/api/industries/migrate/route.ts')
    expect(migrate).toContain("process.env.NODE_ENV === 'production'")
    expect(migrate).toContain("status: 404")
    expect(migrate).toContain("parsedUrl.hostname !== 'res.cloudinary.com'")
    expect(migrate).toContain("allowedRoles: ['SUPER_ADMIN']")
  })

  it('user-owned property routes use live marketplace sessions instead of legacy admin tokens', () => {
    for (const path of [
      'app/api/properties/route.ts',
      'app/api/properties/[id]/route.ts',
      'app/api/properties/[id]/boost/route.ts',
      'app/api/properties/[id]/favorite/route.ts',
      'app/api/properties/[id]/inquiry/route.ts',
      'app/api/properties/[id]/submit/route.ts',
      'app/api/properties/favorites/route.ts',
    ]) {
      const code = source(path)
      expect(code).toContain('authenticateMarketplaceUser')
      expect(code).not.toContain("from '@/lib/auth/authentication/auth-utils'")
    }
  })
})
