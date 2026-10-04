import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertNotSuspended,
  authenticateRequest,
} from '@/lib/auth/compatibility/mobile-auth'

type ClaimResult = {
  currentClaims: number
  maxClaims: number
  alreadyClaimed: boolean
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json().catch(() => ({}))
    const id = typeof body?.id === 'string' ? body.id.trim() : ''

    if (!id || id.length > 128) {
      return NextResponse.json({ error: 'Offer ID is required' }, { status: 400 })
    }

    const result = await prisma.$transaction<ClaimResult>(async tx => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM "FlashOffer"
        WHERE id = ${id}
        FOR UPDATE
      `

      if (locked.length !== 1) {
        throw new Error('OFFER_NOT_FOUND')
      }

      const offer = await tx.flashOffer.findUnique({
        where: { id },
        select: {
          id: true,
          isActive: true,
          startsAt: true,
          expiresAt: true,
          currentClaims: true,
          maxClaims: true,
        },
      })

      if (!offer) throw new Error('OFFER_NOT_FOUND')

      const now = new Date()
      if (!offer.isActive || offer.startsAt > now || offer.expiresAt <= now) {
        throw new Error('OFFER_NOT_AVAILABLE')
      }

      const existing = await tx.flashOfferClaim.findUnique({
        where: {
          flashOfferId_userId: {
            flashOfferId: id,
            userId: user.id,
          },
        },
        select: { id: true },
      })

      if (existing) {
        return {
          currentClaims: offer.currentClaims,
          maxClaims: offer.maxClaims,
          alreadyClaimed: true,
        }
      }

      if (offer.currentClaims >= offer.maxClaims) {
        throw new Error('OFFER_FULLY_CLAIMED')
      }

      await tx.flashOfferClaim.create({
        data: {
          flashOfferId: id,
          userId: user.id,
        },
      })

      const updated = await tx.flashOffer.update({
        where: { id },
        data: { currentClaims: { increment: 1 } },
        select: { currentClaims: true, maxClaims: true },
      })

      return {
        currentClaims: updated.currentClaims,
        maxClaims: updated.maxClaims,
        alreadyClaimed: false,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'OFFER_NOT_FOUND') {
        return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
      }
      if (error.message === 'OFFER_NOT_AVAILABLE') {
        return NextResponse.json({ error: 'Offer is not active' }, { status: 409 })
      }
      if (error.message === 'OFFER_FULLY_CLAIMED') {
        return NextResponse.json({ error: 'Offer is fully claimed' }, { status: 409 })
      }
    }

    secureConsole.error('Error claiming offer:', error)
    return NextResponse.json({ error: 'Failed to claim offer' }, { status: 500 })
  }
}
