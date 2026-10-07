import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyAllAdmins } from '@/lib/admin-notifications'
import { checkRateLimit, ipKey } from '@/lib/rate-limit/middleware'
import { hashPassword } from '@/lib/security/password'
import { randomBytes } from 'node:crypto'

function sanitizeString(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim()
}

export async function GET() {
  try {
    const reviews = await prisma.review.findMany({
      where: { status: 'APPROVED' },
      select: {
        id: true,
        rating: true,
        comment: true,
        customerName: true,
        createdAt: true,
        service: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    return NextResponse.json(reviews)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkRateLimit(request, {
      policyName: 'PUBLIC_SUBMISSION',
      keyPrefix: 'public_review_submission',
      identifier: ipKey(request),
    })
    if (!rateLimit.allowed) return rateLimit.response!

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { rating, comment, customerName, serviceId } = body
    const safeCustomerName = typeof customerName === 'string'
      ? sanitizeString(customerName).slice(0, 120)
      : ''
    const safeComment = typeof comment === 'string'
      ? sanitizeString(comment).slice(0, 2000)
      : null

    if (!rating || !safeCustomerName || typeof serviceId !== 'string' || !serviceId || serviceId.length > 128) {
      return NextResponse.json(
        { error: 'Rating, customer name, and service are required' },
        { status: 400 }
      )
    }

    const parsedRating = parseInt(rating)
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, isActive: true },
      select: { id: true },
    })
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    const guestEmail = 'review-guest@internal.maintainex.invalid'
    let guestUser = await prisma.user.findUnique({ where: { email: guestEmail } })

    if (!guestUser) {
      const disabledPasswordHash = await hashPassword(randomBytes(32).toString('hex'))
      guestUser = await prisma.user.create({
        data: {
          name: 'Public Review Guest',
          email: guestEmail,
          passwordHash: disabledPasswordHash,
          isActive: false,
        },
      })
    }

    const review = await prisma.review.create({
      data: {
        rating: parsedRating,
        comment: safeComment,
        customerName: safeCustomerName,
        serviceId,
        userId: guestUser.id,
        status: 'PENDING'
      }
    })

    await notifyAllAdmins('review_pending', 'New Review Pending', `A ${parsedRating}-star review was submitted for service "${serviceId}"`, '/admin/marketplace/reviews')

    return NextResponse.json(review, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 })
  }
}
