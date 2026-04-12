import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions, isSuperAdmin } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isSuper = isSuperAdmin(session)
    const user = session?.user as any
    const canEdit = user?.canEditServices === true

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
            title: true
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
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isSuper = isSuperAdmin(session)
    const user = session?.user as any
    const canEdit = user?.canEditServices === true

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
