export const PUBLIC_REAL_ESTATE_STATUSES = ['approved', 'published'] as const

const SAFE_PROPERTY_MEDIA_PREFIXES = [
  '/uploads/',
  '/api/mobile/files/',
] as const

export function isPublicRealEstateStatus(status: string): boolean {
  return (PUBLIC_REAL_ESTATE_STATUSES as readonly string[]).includes(status)
}

export function isSafePropertyMediaRef(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const ref = value.trim()
  if (!ref || ref.length > 2048 || ref.startsWith('//') || ref.includes('\\')) return false

  if (SAFE_PROPERTY_MEDIA_PREFIXES.some(prefix => ref.startsWith(prefix))) {
    return !ref.split('?')[0].split('#')[0].split('/').some(segment => segment === '..')
  }

  try {
    const url = new URL(ref)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

export function sanitizePropertyMediaRefs(value: unknown, limit = 10): string[] {
  if (!Array.isArray(value)) return []
  const unique = new Set<string>()

  for (const item of value) {
    if (!isSafePropertyMediaRef(item)) continue
    unique.add(item.trim())
    if (unique.size >= limit) break
  }

  return [...unique]
}

export function readPropertyMediaRefs(value: string | null, limit = 10): string[] {
  if (!value) return []
  try {
    return sanitizePropertyMediaRefs(JSON.parse(value), limit)
  } catch {
    return []
  }
}

function parseStoredStringArray(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 50)
      : []
  } catch {
    return []
  }
}

export function toPublicListingDto<T extends {
  photos: string | null
  amenities: string | null
  contactPhone?: string | null
  contactName?: string | null
  rejectionReason?: string | null
  reviewedBy?: string | null
  reviewedAt?: Date | null
}>(listing: T, options: { includeContact?: boolean } = {}) {
  const {
    contactPhone,
    contactName,
    rejectionReason: _rejectionReason,
    reviewedBy: _reviewedBy,
    reviewedAt: _reviewedAt,
    ...safe
  } = listing

  return {
    ...safe,
    photos: readPropertyMediaRefs(listing.photos),
    amenities: parseStoredStringArray(listing.amenities),
    ...(options.includeContact
      ? {
          contactPhone: contactPhone || null,
          contactName: contactName || null,
        }
      : {}),
  }
}
