import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  isSafePropertyMediaRef,
  sanitizePropertyMediaRefs,
} from '@/lib/real-estate/visibility'

describe('Real-estate public privacy boundary', () => {
  it('does not allow public callers to select pending or rejected listing states', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/api/properties/route.ts'), 'utf8')
    expect(source).toContain('PUBLIC_REAL_ESTATE_STATUSES')
    expect(source).toContain('Public discovery never accepts a caller-selected moderation state')
    expect(source).toContain('Math.min(50')
  })

  it('hides non-public listing detail from non-owners', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/api/properties/[id]/route.ts'), 'utf8')
    expect(source).toContain('isPublicRealEstateStatus')
    expect(source).toContain('if (!isPublic && !isOwner && !isLegacyStaff)')
    expect(source).toContain("return NextResponse.json({ error: 'Listing not found' }, { status: 404 })")
    expect(source).toContain("toPublicListingDto(listing, { includeContact: Boolean(session) })")
  })

  it('restricts favorites and inquiries to public listing states', () => {
    const favorite = readFileSync(resolve(process.cwd(), 'app/api/properties/[id]/favorite/route.ts'), 'utf8')
    const favorites = readFileSync(resolve(process.cwd(), 'app/api/properties/favorites/route.ts'), 'utf8')
    const inquiry = readFileSync(resolve(process.cwd(), 'app/api/properties/[id]/inquiry/route.ts'), 'utf8')
    expect(favorite).toContain('PUBLIC_REAL_ESTATE_STATUSES')
    expect(favorites).toContain('PUBLIC_REAL_ESTATE_STATUSES')
    expect(inquiry).toContain('PUBLIC_REAL_ESTATE_STATUSES')
    expect(inquiry).toContain("message.trim().slice(0, 2000)")
  })

  it('centralizes public DTO redaction', () => {
    const source = readFileSync(resolve(process.cwd(), 'lib/real-estate/visibility.ts'), 'utf8')
    expect(source).toContain('contactPhone')
    expect(source).toContain('rejectionReason')
    expect(source).toContain('reviewedBy')
    expect(source).toContain('includeContact')
  })

  it('accepts only safe HTTPS or MaintainEX media references', () => {
    expect(isSafePropertyMediaRef('https://images.unsplash.com/photo-123?w=800')).toBe(true)
    expect(isSafePropertyMediaRef('/uploads/avatars/example.webp')).toBe(true)
    expect(isSafePropertyMediaRef('/api/mobile/files/user/photo.jpg')).toBe(true)
    expect(isSafePropertyMediaRef('javascript:alert(1)')).toBe(false)
    expect(isSafePropertyMediaRef('data:image/svg+xml,<svg/>')).toBe(false)
    expect(isSafePropertyMediaRef('//evil.example/image.jpg')).toBe(false)
    expect(sanitizePropertyMediaRefs([
      'https://example.com/a.jpg',
      'javascript:alert(1)',
      'https://example.com/a.jpg',
    ])).toEqual(['https://example.com/a.jpg'])
  })

  it('removes the legacy staff shortcut from the public detail route', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/api/properties/[id]/route.ts'), 'utf8')
    expect(source).not.toContain('isLegacyStaff')
    expect(source).toContain('if (!isPublic && !isOwner)')
  })
})
