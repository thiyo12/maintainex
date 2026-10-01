import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlatformRuntimeConfig } from '@/lib/runtime/platform-runtime'

export async function GET() {
  try {
    const runtime = await getPlatformRuntimeConfig()
    if (!runtime.offers.visible) {
      return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
    }

    const now = new Date()
    const offers = await prisma.flashOffer.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        discountType: true,
        discountValue: true,
        linkUrl: true,
        badgeText: true,
        bgColor: true,
        textColor: true,
        startsAt: true,
        expiresAt: true,
        maxClaims: true,
        currentClaims: true,
      },
    })

    return NextResponse.json(
      offers
        .filter(offer => offer.currentClaims < offer.maxClaims)
        .map(offer => ({
          ...offer,
          // Public promotion links must remain internal. Legacy/external values are suppressed.
          linkUrl:
            offer.linkUrl && /^\/(?!\/)/.test(offer.linkUrl)
              ? offer.linkUrl
              : null,
        })),
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    )
  } catch {
    return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 })
  }
}
