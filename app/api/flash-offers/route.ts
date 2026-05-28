import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function GET() {
  try {
    const offers = await prisma.flashOffer.findMany({
      where: {
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { displayOrder: 'asc' },
    })
    return NextResponse.json(offers, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, discountType, discountValue, couponCode, linkUrl, badgeText, bgColor, textColor, startsAt, expiresAt, maxClaims, displayOrder } = body

    if (!title || !discountType || discountValue === undefined || !startsAt || !expiresAt) {
      return NextResponse.json({ error: 'Title, discount type, discount value, start and expiry dates are required' }, { status: 400 })
    }

    let order = displayOrder
    if (order === undefined) {
      const maxOrder = await prisma.flashOffer.aggregate({
        _max: { displayOrder: true },
      })
      order = (maxOrder._max.displayOrder || 0) + 1
    }

    const offer = await prisma.flashOffer.create({
      data: {
        title,
        description: description || null,
        discountType,
        discountValue,
        couponCode: couponCode || null,
        linkUrl: linkUrl || null,
        badgeText: badgeText || '🔥 FLASH',
        bgColor: bgColor || '#FFC300',
        textColor: textColor || '#1a1a1a',
        startsAt: new Date(startsAt),
        expiresAt: new Date(expiresAt),
        maxClaims: maxClaims || 50,
        currentClaims: 0,
        isActive: true,
        displayOrder: order,
      },
    })

    return NextResponse.json(offer, { status: 201 })
  } catch (error) {
    console.error('Error creating offer:', error)
    return NextResponse.json({ error: 'Failed to create offer' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, title, description, discountType, discountValue, couponCode, linkUrl, badgeText, bgColor, textColor, startsAt, expiresAt, maxClaims, isActive, displayOrder } = body

    if (!id) {
      return NextResponse.json({ error: 'Offer ID is required' }, { status: 400 })
    }

    const data: any = {}
    if (title !== undefined) data.title = title
    if (description !== undefined) data.description = description
    if (discountType !== undefined) data.discountType = discountType
    if (discountValue !== undefined) data.discountValue = discountValue
    if (couponCode !== undefined) data.couponCode = couponCode
    if (linkUrl !== undefined) data.linkUrl = linkUrl
    if (badgeText !== undefined) data.badgeText = badgeText
    if (bgColor !== undefined) data.bgColor = bgColor
    if (textColor !== undefined) data.textColor = textColor
    if (startsAt !== undefined) data.startsAt = new Date(startsAt)
    if (expiresAt !== undefined) data.expiresAt = new Date(expiresAt)
    if (maxClaims !== undefined) data.maxClaims = maxClaims
    if (isActive !== undefined) data.isActive = isActive
    if (displayOrder !== undefined) data.displayOrder = displayOrder

    const offer = await prisma.flashOffer.update({
      where: { id },
      data,
    })

    return NextResponse.json(offer)
  } catch (error) {
    console.error('Error updating offer:', error)
    return NextResponse.json({ error: 'Failed to update offer' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Offer ID is required' }, { status: 400 })
    }

    await prisma.flashOffer.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting offer:', error)
    return NextResponse.json({ error: 'Failed to delete offer' }, { status: 500 })
  }
}
