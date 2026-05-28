import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Offer ID is required' }, { status: 400 })
    }

    const offer = await prisma.flashOffer.update({
      where: { id },
      data: {
        currentClaims: { increment: 1 },
      },
    })

    return NextResponse.json({ currentClaims: offer.currentClaims, maxClaims: offer.maxClaims })
  } catch (error) {
    console.error('Error claiming offer:', error)
    return NextResponse.json({ error: 'Failed to claim offer' }, { status: 500 })
  }
}
