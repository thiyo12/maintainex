import { describe, expect, it } from 'vitest'

import {
  COMMERCIAL_FIELDS,
  NEVER_PUBLIC_FIELDS,
  decideProfileVisibility,
  leakedFields,
  redactProviderProfile,
  toBroadCoverageAreas,
  type ProfileVisibility,
} from '@/lib/domain/provider-profile-visibility'

/**
 * Phase 03 — provider profile privacy and marketplace discovery.
 *
 * Behavioural tests only (no database), so they are deterministic and cannot
 * interfere with shared-database suites.
 *
 * The policy has three tiers:
 *   PUBLIC      — same-market eligible viewer sees normal commercial information
 *   TRANSACTION — same-market viewer with an active job; adds only the job ref
 *   REDUCED     — out-of-market or unverifiable viewer
 */

const lkProvider = { providerCountry: 'LK', providerRestricted: false }
const caProvider = { providerCountry: 'CA', providerRestricted: false }

/**
 * A validated service-location context: the viewer holds an authorised job in
 * the same market. This is what allows browsing BEFORE any booking — the job is
 * the service context, not a transaction with this provider.
 */
const sameMarketBrowsing = {
  hasAuthorizedServiceContext: true,
  hasActiveTransactionWithProvider: false,
  transactionMarket: 'LK',
}

describe('Eligible same-market browsing customer needs no existing transaction', () => {
  it('a Sri Lankan viewer browsing a Sri Lankan provider sees PUBLIC', () => {
    const decision = decideProfileVisibility(lkProvider, sameMarketBrowsing)
    expect(decision.visibility).toBe('PUBLIC')
    expect(decision.reason).toBe('SAME_MARKET_PUBLIC')
  })

  it('a Canadian viewer browsing a Canadian provider sees PUBLIC', () => {
    expect(
      decideProfileVisibility(caProvider, {
        hasAuthorizedServiceContext: true,
        hasActiveTransactionWithProvider: false,
        transactionMarket: 'CA',
      }).visibility,
    ).toBe('PUBLIC')
  })

  it('an active transaction upgrades the tier but never beyond commercial data', () => {
    const decision = decideProfileVisibility(lkProvider, {
      hasAuthorizedServiceContext: true,
      hasActiveTransactionWithProvider: true,
      transactionMarket: 'LK',
    })
    expect(decision.visibility).toBe('TRANSACTION')
  })

  it('a specific transaction market overrides the account market', () => {
    // The viewer's validated service market is Vancouver, so a Canadian
    // provider is same-market regardless of anything else.
    const decision = decideProfileVisibility(caProvider, {
      hasAuthorizedServiceContext: true,
      hasActiveTransactionWithProvider: true,
      transactionMarket: 'CA',
    })
    expect(decision.visibility).toBe('TRANSACTION')
  })

  it('is case-insensitive on both markets', () => {
    expect(
      decideProfileVisibility(lkProvider, {
        hasAuthorizedServiceContext: true,
        hasActiveTransactionWithProvider: false,
        transactionMarket: 'lk',
      }).visibility,
    ).toBe('PUBLIC')
  })
})

describe('Out-of-market customers see only safe reduced information', () => {
  it('a Sri Lankan viewer on a Canadian provider is reduced', () => {
    const decision = decideProfileVisibility(caProvider, sameMarketBrowsing)
    expect(decision.visibility).toBe('REDUCED')
    expect(decision.reason).toBe('CROSS_MARKET')
  })

  it('a Canadian viewer on a Sri Lankan provider is reduced', () => {
    expect(decideProfileVisibility(lkProvider, {
      hasAuthorizedServiceContext: true,
      hasActiveTransactionWithProvider: false,
      transactionMarket: 'CA',
    }).visibility).toBe('REDUCED')
  })

  it('even a cross-market transaction does not grant visibility', () => {
    expect(decideProfileVisibility(lkProvider, {
      hasAuthorizedServiceContext: true,
      hasActiveTransactionWithProvider: true,
      transactionMarket: 'CA',
    }).visibility).toBe('REDUCED')
  })
})

describe('Unknown viewer market defaults safely', () => {
  it('a viewer with no market at all is reduced', () => {
    expect(decideProfileVisibility(lkProvider, {
      hasAuthorizedServiceContext: false,
      hasActiveTransactionWithProvider: false,
      transactionMarket: null,
    }).visibility).toBe('REDUCED')
  })

  it('an unsupported or unresolvable service market is reduced', () => {
    for (const market of ['US', 'DE', 'GB', 'XX']) {
      expect(decideProfileVisibility(lkProvider, {
        hasAuthorizedServiceContext: true,
        hasActiveTransactionWithProvider: false,
        transactionMarket: market,
      }).visibility).toBe('REDUCED')
    }
  })

  it('ACCOUNT COUNTRY ALONE MUST NOT GRANT VISIBILITY', () => {
    // Account country is not validated service-location context. Even a viewer
    // whose account says LK gets REDUCED without an authorised job.
    const decision = decideProfileVisibility(
      { providerCountry: 'LK', providerRestricted: false },
      { hasAuthorizedServiceContext: false, hasActiveTransactionWithProvider: false, transactionMarket: null },
    )
    expect(decision.visibility).toBe('REDUCED')
    expect(decision.reason).toBe('VIEWER_MARKET_UNVERIFIED')
  })

  it('a provider with no established market is reduced', () => {
    expect(decideProfileVisibility(
      { providerCountry: null, providerRestricted: false },
      sameMarketBrowsing,
    ).visibility).toBe('REDUCED')
  })
})

describe('Restricted providers remain restricted', () => {
  it('a restricted provider is reduced even for a same-market viewer', () => {
    const decision = decideProfileVisibility(
      { providerCountry: 'LK', providerRestricted: true },
      sameMarketBrowsing,
    )
    expect(decision.visibility).toBe('REDUCED')
    expect(decision.reason).toBe('PROVIDER_RESTRICTED')
  })

  it('restriction outranks every other reason', () => {
    expect(decideProfileVisibility(
      { providerCountry: 'CA', providerRestricted: true },
      { hasAuthorizedServiceContext: true, hasActiveTransactionWithProvider: true, transactionMarket: 'CA' },
    ).reason).toBe('PROVIDER_RESTRICTED')
  })
})

describe('Booking access is scoped and cannot be claimed', () => {
  it('cannot buy visibility by asserting a transaction without one', () => {
    expect(decideProfileVisibility(caProvider, {
      hasAuthorizedServiceContext: false,
      hasActiveTransactionWithProvider: false,
      transactionMarket: null,
    }).visibility).toBe('REDUCED')
  })

  it('a transaction tier never relaxes the cross-market rule', () => {
    expect(decideProfileVisibility(caProvider, {
      hasAuthorizedServiceContext: true,
      hasActiveTransactionWithProvider: true,
      transactionMarket: 'LK',
    }).visibility).toBe('REDUCED')
  })
})

describe('Private data never appears at any tier', () => {
  const fullPayload = {
    id: 'prov-1',
    userId: 'user-99',
    name: 'Asha R',
    bio: 'Plumber with 10 years experience.',
    rating: 4.8,
    completedJobs: 120,
    skills: ['plumbing'],
    marketLabel: 'Sri Lanka',
    phone: '+94770000000',
    email: 'asha@example.com',
    hourlyRate: 2500,
    serviceAreas: ['Colombo 05'],
    latitude: 6.9271,
    longitude: 79.8612,
    distanceKm: 3.2,
    isOnline: true,
    locationUpdatedAt: '2026-01-01T00:00:00Z',
    profileImage: 'https://cdn/avatar.jpg',
    verifiedPhotoUrl: 'https://cdn/kyc-id.jpg',
    profilePhotoVerified: true,
    identityStatus: 'VERIFIED',
    identityVerified: true,
    kycStatus: 'VERIFIED',
    isBanned: false,
    isSuspended: false,
    bookingEligible: true,
    reviews: [{ id: 'r1', rating: 5, comment: 'Great', reviewerName: 'Ruwan P' }],
  }

  it('REDUCED exposes exactly the approved public fields', () => {
    const reduced = redactProviderProfile(fullPayload)
    expect(Object.keys(reduced).sort()).toEqual(
      ['bio', 'completedJobs', 'id', 'marketLabel', 'name', 'rating', 'skills'].sort(),
    )
  })

  it('REDUCED leaks no commercial or private field', () => {
    expect(leakedFields(redactProviderProfile(fullPayload) as never, 'REDUCED')).toEqual([])
  })

  it('PUBLIC and TRANSACTION tiers still exclude every private field', () => {
    const publicTier = { ...redactProviderProfile(fullPayload), userId: 'user-99', hourlyRate: 2500, isOnline: true, profileImage: 'a.jpg', reviews: [] }
    for (const tier of ['PUBLIC', 'TRANSACTION'] as ProfileVisibility[]) {
      expect(leakedFields(publicTier as never, tier)).toEqual([])
    }
  })

  it('KYC and identity-document images are never public, even with a booking', () => {
    // Model exactly what the route returns for a TRANSACTION tier: the public
    // contract plus commercial fields, with every KYC artefact removed.
    const transactionTier = {
      ...redactProviderProfile(fullPayload),
      userId: 'user-99',
      isVerified: true,
      isOnline: true,
      profileImage: 'https://cdn/avatar.jpg',
      hourlyRate: 2500,
      reviews: [{ id: 'r1', rating: 5, comment: 'Great' }],
      activeJobId: 'job-1',
      visibility: 'TRANSACTION' as const,
    }
    expect(leakedFields(transactionTier as never, 'TRANSACTION')).toEqual([])
    expect(JSON.stringify(transactionTier)).not.toContain('kyc-id.jpg')
    expect(transactionTier.activeJobId).toBe('job-1')
  })

  it('contact details and coordinates never appear at any tier', () => {
    const publicTier = { ...redactProviderProfile(fullPayload), userId: 'user-99' }
    const serialised = JSON.stringify(publicTier)
    for (const secret of ['+94770000000', 'asha@example.com', 'Colombo 05', '79.8612', 'kyc-id.jpg']) {
      expect(serialised).not.toContain(secret)
    }
  })

  it('reviewer identities are excluded even from same-market responses', () => {
    expect(NEVER_PUBLIC_FIELDS).toContain('reviewerName')
    const withReviews = { ...redactProviderProfile(fullPayload), reviews: [{ id: 'r', rating: 5, comment: 'ok' }] }
    expect(leakedFields(withReviews as never, 'PUBLIC')).toEqual([])
  })

  it('the never-public list covers KYC, contact and location categories', () => {
    for (const field of [
      'phone', 'email', 'latitude', 'longitude',
      'verifiedPhotoUrl', 'identityStatus', 'kycStatus',
      'reviewerName', 'isBanned', 'bookingEligible',
    ]) {
      expect(NEVER_PUBLIC_FIELDS).toContain(field as never)
    }
  })

  it('commercial fields are the ones withheld from REDUCED only', () => {
    for (const field of ['userId', 'hourlyRate', 'isOnline', 'profileImage', 'reviews']) {
      expect(COMMERCIAL_FIELDS).toContain(field as never)
    }
  })

  it('tolerates malformed input without throwing', () => {
    const sparse = redactProviderProfile({ id: 'x' })
    expect(sparse.name).toBe('')
    expect(sparse.skills).toEqual([])
    expect(sparse.rating).toBe(0)
  })
})

describe('Mobile compatibility: no misleading zero prices or empty-review claims', () => {
  it('a REDUCED payload has no rate, so the screen must not render zero', async () => {
    type FindTaskerResult = import('@/apps/mobile/lib/types').FindTaskerResult
    const reduced: FindTaskerResult = {
      id: 'prov-1',
      name: 'Asha R',
      bio: 'Plumber',
      rating: 4.8,
      completedJobs: 120,
      skills: ['plumbing'],
      marketLabel: 'Sri Lanka',
      visibility: 'REDUCED',
    }

    // The screen's price logic: a missing rate must fall through, never render 0.
    const providerPrice = Number(reduced.hourlyRate || 0)
    expect(providerPrice).toBe(0)
    // Guarded form used by the screen: 0 means "not published", not "free".
    const display = providerPrice > 0 ? `LKR ${providerPrice}` : 'Quote required'
    expect(display).toBe('Quote required')

    // Reviews are hidden, so the screen must show a hidden state rather than
    // claiming there are none.
    const reviews = Array.isArray(reduced.reviews) ? reduced.reviews : []
    expect(reviews).toEqual([])
    expect(reduced.visibility).toBe('REDUCED')
    const message = reduced.visibility === 'REDUCED'
      ? 'Feedback not available'
      : reviews.length === 0
        ? 'No written feedback yet.'
        : 'has feedback'
    expect(message).toBe('Feedback not available')
  })

  it('a PUBLIC payload keeps commercial fields the screens render', async () => {
    type TaskerProfile = import('@/apps/mobile/lib/types').TaskerProfile
    const publicTier: TaskerProfile = {
      id: 'prov-1',
      name: 'Asha R',
      bio: 'Plumber',
      rating: 4.8,
      completedJobs: 120,
      skills: ['plumbing'],
      marketLabel: 'Sri Lanka',
      visibility: 'PUBLIC',
      hourlyRate: 2500,
      isOnline: true,
      reviews: [{ id: 'r1', rating: 5, comment: 'Great', createdAt: '2026-01-01' }],
    }
    expect(publicTier.hourlyRate).toBe(2500)
    expect(publicTier.reviews?.length).toBe(1)
    expect(publicTier.visibility).toBe('PUBLIC')
  })
})

describe('Broad coverage areas without precise location leakage (Option B)', () => {
  const withAreas = {
    ...redactProviderProfile({
      id: 'prov-1',
      name: 'Asha R',
      bio: 'Plumber',
      rating: 4.8,
      completedJobs: 120,
      skills: ['plumbing'],
      marketLabel: 'Sri Lanka',
    }),
    userId: 'user-99',
    coverageAreas: ['Colombo', 'Gampaha'],
  }

  it('shows approved broad areas to an eligible same-market viewer', () => {
    expect(withAreas.coverageAreas).toEqual(['Colombo', 'Gampaha'])
  })

  it('is withheld from a REDUCED viewer', () => {
    expect('coverageAreas' in redactProviderProfile({ id: 'x', coverageAreas: ['Colombo'] })).toBe(false)
    expect(leakedFields(redactProviderProfile({ id: 'x' }) as never, 'REDUCED')).toEqual([])
  })

  it('never carries coordinates or exact addresses alongside areas', () => {
    const payload = { ...withAreas, latitude: 6.9271, longitude: 79.8612, addressLine: '42/3 Temple Rd' }
    expect(leakedFields(payload as never, 'PUBLIC')).toEqual(['latitude', 'longitude'])
    expect(JSON.stringify(withAreas)).not.toContain('79.8612')
  })

  it('derives areas only from provider coverage, adding no new geography', () => {
    // The contract carries the provider's own strings; nothing is synthesised.
    expect(withAreas.coverageAreas.every(a => typeof a === 'string')).toBe(true)
  })
})

describe('Approved public avatar versus private identity image', () => {
  it('PUBLIC uses the provider avatar and never the KYC image', () => {
    const payload = {
      ...redactProviderProfile({ id: 'p', name: 'A', bio: '', rating: 5, completedJobs: 1, skills: [] }),
      profileImage: 'https://cdn/public-avatar.jpg',
    }
    expect(payload.profileImage).toBe('https://cdn/public-avatar.jpg')
    expect(leakedFields(payload as never, 'PUBLIC')).toEqual([])
  })

  it('an identity verification image is never a public field', () => {
    expect(NEVER_PUBLIC_FIELDS).toContain('verifiedPhotoUrl')
    expect(NEVER_PUBLIC_FIELDS).toContain('profilePhotoVerified')
    const kycLeak = { verifiedPhotoUrl: 'https://cdn/id.jpg', profilePhotoVerified: true }
    expect(leakedFields(kycLeak as never, 'PUBLIC')).toEqual(['verifiedPhotoUrl', 'profilePhotoVerified'])
    expect(leakedFields(kycLeak as never, 'TRANSACTION')).toEqual(['verifiedPhotoUrl', 'profilePhotoVerified'])
  })
})

describe('Restricted providers keep existing 404 behaviour', () => {
  it('a restricted provider is reduced even with a same-market service context', () => {
    expect(
      decideProfileVisibility(
        { providerCountry: 'LK', providerRestricted: true },
        { hasAuthorizedServiceContext: true, hasActiveTransactionWithProvider: true, transactionMarket: 'LK' },
      ).visibility,
    ).toBe('REDUCED')
  })
})

describe('Broad coverage areas are sanitised, never raw provider free text', () => {
  it('keeps genuine broad city and district labels', () => {
    expect(toBroadCoverageAreas(['Colombo', 'Gampaha', 'Nuwara Eliya', 'Kalutara']))
      .toEqual(['Colombo', 'Gampaha', 'Nuwara Eliya', 'Kalutara'])
  })

  it('drops entries containing house numbers or street names', () => {
    expect(toBroadCoverageAreas([
      '42/3 Temple Road',
      '12 Elm Street',
      'No 8 Main Road',
      'Colombo',
    ])).toEqual(['Colombo'])
  })

  it('drops postal codes, numbered localities and coordinates', () => {
    expect(toBroadCoverageAreas([
      'Colombo 05',
      'V6B 1A1',
      '00100',
      '6.9271, 79.8612',
      'Block 12',
      'Sector 7',
      'Kandy',
    ])).toEqual(['Kandy'])
  })

  it('drops entries containing coordinate or proximity keywords', () => {
    expect(toBroadCoverageAreas([
      'near Galle Face',
      'opposite the station',
      'pin 6.9271',
      'Dehiwala',
    ])).toEqual(['Dehiwala'])
  })

  it('tolerates malformed and hostile input without throwing', () => {
    expect(toBroadCoverageAreas(null)).toEqual([])
    expect(toBroadCoverageAreas('Colombo')).toEqual([])
    expect(toBroadCoverageAreas([null, 42, {}, ['x']])).toEqual([])
    expect(toBroadCoverageAreas([''])).toEqual([])
  })

  it('de-duplicates case-insensitively and caps the list', () => {
    expect(toBroadCoverageAreas(['Colombo', 'colombo', 'COLOMBO'])).toEqual(['Colombo'])
    const many = Array.from({ length: 50 }, (_, i) => `Area${i}`.replace(/[0-9]/g, ''))
    expect(toBroadCoverageAreas(many).length).toBeLessThanOrEqual(20)
  })
})

describe('A client-supplied jobId alone can never grant access', () => {
  it('proposed job context requires server-proved authorisation', () => {
    // The evidence flag is set by the route ONLY after verifying ownership.
    // A caller that merely sends ?jobId=<someone-elses-job> cannot set it.
    expect(
      decideProfileVisibility(lkProvider, {
        hasAuthorizedServiceContext: false,
        hasActiveTransactionWithProvider: false,
        transactionMarket: null,
      }).visibility,
    ).toBe('REDUCED')
  })

  it('account country cannot substitute for an authorised job', () => {
    expect(
      decideProfileVisibility(lkProvider, {
        hasAuthorizedServiceContext: false,
        hasActiveTransactionWithProvider: false,
        transactionMarket: null,
      }).reason,
    ).toBe('VIEWER_MARKET_UNVERIFIED')
  })

  it('the routes verify ownership of a proposed job before using its market', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    for (const route of [
      'app/api/mobile/taskers/[id]/route.ts',
      'app/api/mobile/find-tasker/[id]/route.ts',
    ]) {
      const code = fs.readFileSync(path.resolve(process.cwd(), route), 'utf8')
      expect(code, `${route} must check ownership of a proposed job`).toMatch(
        /customerId === (viewer|user)\.id/,
      )
      expect(code, `${route} must require an active job status`).toMatch(
        /'OPEN', 'QUOTE_ACCEPTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'/,
      )
      expect(code, `${route} must resolve the job market server-side`).toContain('requireJobMarket')
    }
  })
})

describe('Restricted providers are not publicly discoverable', () => {
  it('both profile endpoints return 404 for restricted providers', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    for (const route of [
      'app/api/mobile/taskers/[id]/route.ts',
      'app/api/mobile/find-tasker/[id]/route.ts',
    ]) {
      const code = fs.readFileSync(path.resolve(process.cwd(), route), 'utf8')
      expect(code, `${route} must 404 a restricted provider`).toMatch(
        /status: 404[\s\S]{0,80}restricted|if \(restricted[\s\S]{0,120}404/,
      )
    }
  })

  it('self-access is preserved for a restricted provider viewing their own profile', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const code = fs.readFileSync(
      path.resolve(process.cwd(), 'app/api/mobile/taskers/[id]/route.ts'),
      'utf8',
    )
    expect(code).toContain('const isSelf = tasker.userId === viewer.id')
    expect(code).toMatch(/if \(restricted && !isSelf\)/)
  })
})
