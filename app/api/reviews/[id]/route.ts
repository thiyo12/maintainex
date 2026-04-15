import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isSuper = session.role === 'SUPER_ADMIN'
    const canEdit = session.canEditServices === true

    if (!isSuper && !canEdit) {
      return NextResponse.json({ error: 'You do not have permission to manage reviews' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const review = await prisma.review.update({
      where: { id },
      data: { status },
      include: {
        service: {
          select: {
            name: true
          }
        }
      }
    })

    return NextResponse.json(review)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isSuper = session.role === 'SUPER_ADMIN'
    const canEdit = session.canEditServices === true

    if (!isSuper && !canEdit) {
      return NextResponse.json({ error: 'You do not have permission to delete reviews' }, { status: 403 })
    }

    const { id } = await params

    await prisma.review.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 })
  }
}
