import { NextRequest, NextResponse } from 'next/server'
import { assertCrmCountryAllowed, guardCrmRequest } from '@/lib/crm/security'
import { prisma } from '@/lib/prisma'

async function authorizeReviewMutation(request: NextRequest, id: string) {
  const guard = await guardCrmRequest(request, {
    permission: 'catalog:edit',
    level: 'mutation',
    requireCountryScope: true,
  })
  if (!guard.ok) return { ok: false as const, response: guard.response }

  const review = await prisma.review.findUnique({
    where: { id },
    include: {
      service: {
        select: { id: true, name: true, countryCode: true },
      },
    },
  })
  if (!review) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Review not found' }, { status: 404 }),
    }
  }

  if (!assertCrmCountryAllowed(guard.context, review.service.countryCode)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Review is outside your assigned countries' }, { status: 403 }),
    }
  }

  return { ok: true as const, review }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await authorizeReviewMutation(request, id)
    if (!access.ok) return access.response

    const body = await request.json()
    const status = body?.status
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const review = await prisma.review.update({
      where: { id },
      data: { status },
      include: {
        service: {
          select: { name: true },
        },
      },
    })

    return NextResponse.json(review)
  } catch {
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await authorizeReviewMutation(request, id)
    if (!access.ok) return access.response

    await prisma.review.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 })
  }
}
