import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'MANAGER', 'USER_MANAGEMENT']

// GET: List all wishlist items or waitlist signups
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view')

    if (view === 'waitlist') {
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')
      const skip = (page - 1) * limit

      const entries = await prisma.waitlistEntry.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      })

      const total = await prisma.waitlistEntry.count()

      return NextResponse.json({
        entries,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      })
    }

    const status = searchParams.get('status') // NEW, PLANNED, IN_PROGRESS, COMPLETED, REJECTED
    const category = searchParams.get('category') // GENERAL, APP, WEBSITE, ADMIN, API
    const priority = searchParams.get('priority') // LOW, MEDIUM, HIGH, CRITICAL
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = {}
    if (status) where.status = status
    if (category) where.category = category
    if (priority) where.priority = priority

    const items = await prisma.wishlistItem.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      skip,
      take: limit
    })

    const total = await prisma.wishlistItem.count({ where })

    const summary = {
      new: await prisma.wishlistItem.count({ where: { status: 'NEW' } }),
      planned: await prisma.wishlistItem.count({ where: { status: 'PLANNED' } }),
      inProgress: await prisma.wishlistItem.count({ where: { status: 'IN_PROGRESS' } }),
      completed: await prisma.wishlistItem.count({ where: { status: 'COMPLETED' } }),
      rejected: await prisma.wishlistItem.count({ where: { status: 'REJECTED' } })
    }

    return NextResponse.json({
      items,
      summary,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Wishlist GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch wishlist items' }, { status: 500 })
  }
}

// POST: Create new wishlist item
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const { title, description, category, priority, requestedBy } = body

    if (!title || !description) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 })
    }

    const item = await prisma.wishlistItem.create({
      data: {
        title,
        description,
        category: category || 'GENERAL',
        priority: priority || 'MEDIUM',
        requestedBy,
        status: 'NEW'
      }
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('Wishlist POST error:', error)
    return NextResponse.json({ error: 'Failed to create wishlist item' }, { status: 500 })
  }
}

// PUT: Update wishlist item
export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const { itemId, status, priority, assignedTo, notes } = body

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    const updateData: any = {}
    if (status) updateData.status = status
    if (priority) updateData.priority = priority
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo
    if (notes !== undefined) updateData.notes = notes
    if (status === 'COMPLETED') updateData.completedAt = new Date()

    const item = await prisma.wishlistItem.update({
      where: { id: itemId },
      data: updateData
    })

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Wishlist PUT error:', error)
    return NextResponse.json({ error: 'Failed to update wishlist item' }, { status: 500 })
  }
}

// DELETE: Delete wishlist item
export async function DELETE(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    await prisma.wishlistItem.delete({
      where: { id: itemId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Wishlist DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete wishlist item' }, { status: 500 })
  }
}
