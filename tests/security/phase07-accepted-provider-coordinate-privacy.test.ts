import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const route = readFileSync(resolve(process.cwd(), 'app/api/mobile/v2/jobs/[id]/route.ts'), 'utf8')

describe('Phase 07 — accepted provider details never leak exact coordinates', () => {
  it('does not query precise individual tasker coordinates for accepted quote summaries', () => {
    const start = route.indexOf('async function getVerifiedTaskerPublicIdentity')
    const end = route.indexOf('export async function GET(', start)
    const summary = route.slice(start, end)
    expect(summary).not.toContain('latitude: true')
    expect(summary).not.toContain('longitude: true')
    expect(summary).toContain('profilePhotoVerified')
    expect(summary).toContain('identityVerified')
  })

  it('does not query or expose precise company provider coordinates', () => {
    const start = route.indexOf('const company = await prisma.companyProfile.findUnique({', route.indexOf('let acceptedProvider'))
    const end = route.indexOf('const [customerReviews', start)
    const summary = route.slice(start, end)
    expect(summary).not.toContain('latitude: true')
    expect(summary).not.toContain('longitude: true')
    expect(summary).not.toContain('latitude: company.latitude')
    expect(summary).not.toContain('longitude: company.longitude')
    expect(summary).toContain('company.companyName')
  })

  it('retains the shared-address gate for customer job location only', () => {
    expect(route).toContain("!!acceptedQuote && acceptedQuote.status === 'ACCEPTED' && !!job.addressSharedAt")
    expect(route).toContain('latitude: canViewExactLocation ? job.latitude : null')
    expect(route).toContain('longitude: canViewExactLocation ? job.longitude : null')
  })
  it('keeps provider User.id stable and does not expose internal KYC status flags', () => {
    const start = route.indexOf('async function getVerifiedTaskerPublicIdentity')
    const end = route.indexOf('export async function GET(', start)
    const summary = route.slice(start, end)
    expect(summary).toContain('providerProfileId: profile.id')
    expect(summary).not.toContain('...profile,')
    expect(summary).not.toContain('verificationStatus: profile.verificationStatus')
    expect(summary).not.toContain('kycStatus: identity?.kycStatus')
    expect(route).toContain('if (providerUser) acceptedProvider = { ...providerUser, ...providerProfile }')
  })
})
