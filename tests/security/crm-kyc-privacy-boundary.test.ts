import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('CRM KYC privacy boundary', () => {
  it('does not return raw KYC or profile proof URLs from the admin list API', () => {
    const route = source('app/api/admin/kyc/route.ts')

    expect(route).not.toContain('imageUrl: true')
    expect(route).not.toContain('experienceProofUrl: true')
    expect(route).not.toContain('drivingLicenseUrl: true')
    expect(route).not.toContain('staffProofUrl: true')
    expect(route).not.toContain('businessRegDocUrl: true')
  })

  it('honors live permission overrides for KYC decisions', () => {
    const route = source('app/api/admin/kyc/route.ts')

    expect(route).toContain('evaluateEffectivePermission')
    expect(route).toContain('overrides: security.permissionOverrides')
    expect(route).not.toContain('crmHasPermission(security.role, requiredPermission)')
  })

  it('loads document bytes through a guarded market-scoped proxy', () => {
    const route = source('app/api/admin/kyc/[id]/file/route.ts')

    expect(route).toContain("permission: 'kyc:view'")
    expect(route).toContain('requireCountryScope: true')
    expect(route).toContain('assertCrmCountryAllowed')
    expect(route).toContain("action: 'KYC_DOCUMENT_VIEW'")
    expect(route).toContain("'Cache-Control': 'private, no-store, max-age=0'")
    expect(route).toContain("'X-Content-Type-Options': 'nosniff'")
  })

  it('never places the stored source URL in the KYC browser UI', () => {
    const page = source('app/(admin)/admin/kyc/page.tsx')

    expect(page).not.toContain('doc.imageUrl')
    expect(page).not.toContain('lightboxDoc.imageUrl')
    expect(page).toContain('/api/admin/kyc/${doc.id}/file')
    expect(page).toContain('/api/admin/kyc/${lightboxDoc.id}/file')
  })
})
