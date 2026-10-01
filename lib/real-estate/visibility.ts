export const PUBLIC_REAL_ESTATE_STATUSES = ['approved', 'published'] as const

export function isPublicRealEstateStatus(status: string): boolean {
  return (PUBLIC_REAL_ESTATE_STATUSES as readonly string[]).includes(status)
}

function parseStoredArray(value: string | null): unknown[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
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
    photos: parseStoredArray(listing.photos),
    amenities: parseStoredArray(listing.amenities),
    ...(options.includeContact
      ? {
          contactPhone: contactPhone || null,
          contactName: contactName || null,
        }
      : {}),
  }
}
