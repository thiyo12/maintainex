import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Phase 11 flash-offer redemption boundary', () => {
  it('retires the legacy public flash-offer write surface', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/flash-offers/route.ts'),
      'utf8'
    )

    expect(source).toContain('export async function GET')
    expect(source).not.toContain('export async function POST')
    expect(source).not.toContain('export async function PUT')
    expect(source).not.toContain('export async function DELETE')
    expect(source).not.toContain('couponCode:')
    expect(source).toContain('startsAt: { lte: now }')
    expect(source).toContain('offer.currentClaims < offer.maxClaims')
  })

  it('requires an authenticated non-suspended user for claims', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/flash-offers/claim/route.ts'),
      'utf8'
    )

    expect(source).toContain('authenticateRequest(request)')
    expect(source).toContain('assertNotSuspended(user)')
    expect(source).toContain('FOR UPDATE')
    expect(source).toContain('flashOfferClaim.findUnique')
    expect(source).toContain('flashOfferClaim.create')
    expect(source).toContain('alreadyClaimed: true')
  })

  it('persists a unique per-user claim invariant', () => {
    const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    const migration = readFileSync(
      resolve(process.cwd(), 'prisma/migrations/20261002002000_flash_offer_claims/migration.sql'),
      'utf8'
    )

    expect(schema).toContain('model FlashOfferClaim')
    expect(schema).toContain('@@unique([flashOfferId, userId])')
    expect(migration).toContain('FlashOfferClaim_flashOfferId_userId_key')
    expect(migration).toContain('FOREIGN KEY ("flashOfferId")')
  })
})
