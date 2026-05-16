import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function sanitizeString(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim()
}

export async function GET() {
  try {
    const reviews = await prisma.review.findMany({
      include: {
        service: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(reviews)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { rating, comment, customerName, serviceId } = body

    if (!rating || !customerName || !serviceId) {
      return NextResponse.json(
        { error: 'Rating, customer name, and service are required' },
        { status: 400 }
      )
    }

    const parsedRating = parseInt(rating)
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
    }

    let guestUser = await prisma.user.findFirst({ where: { email: 'guest@maintain.lk' } })
    
    if (!guestUser) {
      guestUser = await prisma.user.create({
        data: {
          email: 'guest@maintain.lk',
          passwordHash: 'guest',
          name: 'Guest User'
        }
      })
    }

    const review = await prisma.review.create({
      data: {
        rating: parsedRating,
        comment: comment ? sanitizeString(comment) : null,
        customerName: sanitizeString(customerName),
        serviceId,
        userId: guestUser.id,
        status: 'PENDING'
      }
    })

    return NextResponse.json(review, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 })
  }
}
