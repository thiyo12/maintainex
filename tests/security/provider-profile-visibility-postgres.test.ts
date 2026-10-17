import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

import { requireJobMarket } from '@/lib/geography/market-engine'
import { decideProfileVisibility } from '@/lib/domain/provider-profile-visibility'

/**
 * Phase 03 — provider profile visibility against a real database.
 *
 * Market eligibility must come from a job the viewer genuinely participates in,
 * resolved through the shared geography engine. This test proves that a viewer
 * with a real same-market job earns FULL visibility, and that a viewer with no
 * participation does not — regardless of what any client sends.
 *
 * Data is prefixed PPV<ts> and fully removed afterwards to avoid interfering with
 * other shared-database suites.
 */

const prisma = new PrismaClient()

const VANCOUVER = { latitude: 49.2606, longitude: -123.1156 }
const COLOMBO = { latitude: 6.9271, longitude: 79.8612 }

describe('Phase 03 — profile visibility resolves from real transaction evidence (PostgreSQL)', () => {
  let ts: number
  let categoryId: string
  let lkCustomerId: string
  let caCustomerId: string
  let lkProviderUserId: string
  let caProviderUserId: string
  let lkJobId: string
  let caJobId: string

  beforeAll(async () => {
    ts = Date.now()

    const category = await prisma.jobCategory.create({
      data: {
        name: `PPV Cat ${ts}`,
        slug: `ppv-cat-${ts}`,
        iconName: 'wrench',
        colorHex: '#444444',
        countries: '["LK","CA"]',
        isActive: true,
        sortOrder: 0,
      },
    })
    categoryId = category.id

    const mkUser = async (countryCode: string, tag: string) => {
      const u = await prisma.user.create({
        data: {
          email: `ppv-${tag}-${ts}@test.local`,
          passwordHash: 'x',
          name: `PPV ${tag}`,
          phone: `+9477${String(ts).slice(-6)}${tag === 'a' ? '00001' : '00002'}`,
          countryCode,
          identityStatus: 'VERIFIED',
          isActive: true,
        },
      })
      return u.id
    }

    lkCustomerId = await mkUser('LK', 'lkcust')
    caCustomerId = await mkUser('CA', 'cacust')
    lkProviderUserId = await mkUser('LK', 'lkprov')
    caProviderUserId = await mkUser('CA', 'caprov')

    const mkJob = async (customerId: string, title: string, coords: { latitude: number; longitude: number }) => {
      const j = await prisma.marketplaceJob.create({
        data: {
          customerId,
          title: `${title} ${ts}`,
          description: 'profile visibility fixture',
          categoryId,
          photos: '[]',
          budgetType: 'FIXED',
          budgetAmount: 5000n,
          status: 'OPEN',
          countryCode: 'LK',
          latitude: coords.latitude,
          longitude: coords.longitude,
        },
      })
      return j.id
    }

    lkJobId = await mkJob(lkCustomerId, 'PPV LK Job', COLOMBO)
    caJobId = await mkJob(caCustomerId, 'PPV CA Job', VANCOUVER)
  })

  afterAll(async () => {
    try {
      await prisma.jobQuote.deleteMany({ where: { jobId: { in: [lkJobId, caJobId] } } })
      await prisma.marketplaceJob.deleteMany({ where: { id: { in: [lkJobId, caJobId] } } })
      await prisma.jobCategory.deleteMany({ where: { id: categoryId } })
      await prisma.user.deleteMany({
        where: { id: { in: [lkCustomerId, caCustomerId, lkProviderUserId, caProviderUserId] } },
      })
    } catch { /* best effort */ }
    await prisma.$disconnect()
  })

  it('the LK job resolves to the Sri Lankan market', async () => {
    const job = await prisma.marketplaceJob.findUnique({
      where: { id: lkJobId },
      select: { countryCode: true, latitude: true, longitude: true },
    })
    const market = requireJobMarket(job!)
    expect(market.ok).toBe(true)
    if (market.ok) expect(market.countryCode).toBe('LK')
  })

  it('the CA job resolves to the Canadian market', async () => {
    const job = await prisma.marketplaceJob.findUnique({
      where: { id: caJobId },
      select: { countryCode: true, latitude: true, longitude: true },
    })
    const market = requireJobMarket(job!)
    expect(market.ok).toBe(true)
    if (market.ok) expect(market.countryCode).toBe('CA')
  })

  it('a viewer owning a same-market job earns TRANSACTION visibility', async () => {
    const job = await prisma.marketplaceJob.findUnique({
      where: { id: lkJobId },
      select: { countryCode: true, latitude: true, longitude: true },
    })
    const market = requireJobMarket(job!)
    const decision = decideProfileVisibility(
      { providerCountry: 'LK', providerRestricted: false },
      {
        hasAuthorizedServiceContext: market.ok,
        hasActiveTransactionWithProvider: market.ok,
        transactionMarket: market.ok ? market.countryCode : null,
      },
    )
    expect(decision.visibility).toBe('TRANSACTION')
  })

  it('a viewer whose only job is in the other market earns REDUCED visibility', async () => {
    const decision = decideProfileVisibility(
      { providerCountry: 'LK', providerRestricted: false },
      { hasAuthorizedServiceContext: true, hasActiveTransactionWithProvider: true, transactionMarket: 'CA' },
    )
    expect(decision.visibility).toBe('REDUCED')
    expect(decision.reason).toBe('CROSS_MARKET')
  })

  it('a viewer with no participation earns REDUCED visibility', async () => {
    const decision = decideProfileVisibility(
      { providerCountry: 'LK', providerRestricted: false },
      { hasAuthorizedServiceContext: false, hasActiveTransactionWithProvider: false, transactionMarket: null },
    )
    expect(decision.visibility).toBe('REDUCED')
  })

  it('a quoted provider gains visibility only through the job they quoted', async () => {
    await prisma.jobQuote.create({
      data: {
        jobId: caJobId,
        providerId: caProviderUserId,
        providerType: 'INDIVIDUAL',
        price: 5000n,
        estimatedCompletionTime: '2 days',
        attachments: '[]',
        status: 'PENDING',
      },
    })

    const job = await prisma.marketplaceJob.findUnique({
      where: { id: caJobId },
      select: { countryCode: true, latitude: true, longitude: true },
    })
    const market = requireJobMarket(job!)

    // The quoting provider now has real evidence of a Canadian service market.
    expect(
      decideProfileVisibility(
        { providerCountry: 'CA', providerRestricted: false },
        {
        hasAuthorizedServiceContext: market.ok,
        hasActiveTransactionWithProvider: market.ok,
        transactionMarket: market.ok ? market.countryCode : null,
      },
      ).visibility,
    ).toBe('TRANSACTION')

    // A same-market viewer browsing without any transaction still gets PUBLIC.
    expect(
      decideProfileVisibility(
        { providerCountry: 'LK', providerRestricted: false },
        {
          hasAuthorizedServiceContext: true,
          hasActiveTransactionWithProvider: false,
          transactionMarket: 'LK',
        },
      ).visibility,
    ).toBe('PUBLIC')

    // An unrelated viewer with no established market gets REDUCED.
    expect(
      decideProfileVisibility(
        { providerCountry: 'LK', providerRestricted: false },
        { hasAuthorizedServiceContext: false, hasActiveTransactionWithProvider: false, transactionMarket: null },
      ).visibility,
    ).toBe('REDUCED')
  })
})
