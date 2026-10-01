import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'

const VALID_STATUS = new Set(['NEW', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'])
const VALID_CATEGORY = new Set(['GENERAL', 'APP', 'WEBSITE', 'ADMIN', 'API'])
const VALID_PRIORITY = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'wishlist:view',
      level: 'read',
    })
    if (!guard.ok) return guard.response

    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view')

    if (view === 'waitlist') {
      const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
      const skip = (page - 1) * limit

      const [entries, total] = await Promise.all([
        prisma.waitlistEntry.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            location: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.waitlistEntry.count(),
      ])

      return NextResponse.json(
        {
          entries,
          pagination: {
            page,
            limit,
            total,
            pages: Math.max(1, Math.ceil(total / limit)),
          },
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const status = (searchParams.get('status') || '').toUpperCase()
    const category = (searchParams.get('category') || '').toUpperCase()
    const priority = (searchParams.get('priority') || '').toUpperCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    if (status && !VALID_STATUS.has(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    if (category && !VALID_CATEGORY.has(category)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    if (priority && !VALID_PRIORITY.has(priority)) return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })

    const where: any = {}
    if (status) where.status = status
    if (category) where.category = category
    if (priority) where.priority = priority

    const [items, total, summaryRows] = await Promise.all([
      prisma.wishlistItem.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.wishlistItem.count({ where }),
      prisma.wishlistItem.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ])

    const counts = new Map(summaryRows.map(row => [row.status, row._count._all]))
    return NextResponse.json(
      {
        items,
        summary: {
          new: counts.get('NEW') || 0,
          planned: counts.get('PLANNED') || 0,
          inProgress: counts.get('IN_PROGRESS') || 0,
          completed: counts.get('COMPLETED') || 0,
          rejected: counts.get('REJECTED') || 0,
        },
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM wishlist GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch wishlist items' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'wishlist:manage',
      level: 'mutation',
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 200) : ''
    const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 5000) : ''
    const category = typeof body?.category === 'string' ? body.category.toUpperCase() : 'GENERAL'
    const priority = typeof body?.priority === 'string' ? body.priority.toUpperCase() : 'MEDIUM'
    const requestedBy = typeof body?.requestedBy === 'string' ? body.requestedBy.trim().slice(0, 200) : undefined

    if (title.length < 2 || description.length < 3) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 })
    }
    if (!VALID_CATEGORY.has(category) || !VALID_PRIORITY.has(priority)) {
      return NextResponse.json({ error: 'Invalid category or priority' }, { status: 400 })
    }

    const item = await prisma.wishlistItem.create({
      data: {
        title,
        description,
        category,
        priority,
        requestedBy,
        status: 'NEW',
      },
    })

    await createAuditLog({
      action: 'CREATE',
      category: 'SYSTEM',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'WishlistItem',
      entityId: item.id,
      entityName: item.title,
      description: 'CRM product-backlog item created',
      newValue: { title, category, priority, requestedBy },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'LOW',
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('CRM wishlist POST error:', error)
    return NextResponse.json({ error: 'Failed to create wishlist item' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'wishlist:manage',
      level: 'mutation',
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const itemId = typeof body?.itemId === 'string' ? body.itemId : ''
    if (!itemId || itemId.length > 128) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    const existing = await prisma.wishlistItem.findUnique({ where: { id: itemId } })
    if (!existing) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    const updateData: Record<string, unknown> = {}
    if (body?.status !== undefined) {
      const status = String(body.status).toUpperCase()
      if (!VALID_STATUS.has(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      updateData.status = status
      updateData.completedAt = status === 'COMPLETED' ? new Date() : null
    }
    if (body?.priority !== undefined) {
      const priority = String(body.priority).toUpperCase()
      if (!VALID_PRIORITY.has(priority)) return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
      updateData.priority = priority
    }
    if (body?.assignedTo !== undefined) {
      updateData.assignedTo = typeof body.assignedTo === 'string' && body.assignedTo.trim()
        ? body.assignedTo.trim().slice(0, 128)
        : null
    }
    if (body?.notes !== undefined) {
      updateData.notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 5000) : null
    }

    if (!Object.keys(updateData).length) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const item = await prisma.wishlistItem.update({
      where: { id: itemId },
      data: updateData,
    })

    await createAuditLog({
      action: 'UPDATE',
      category: 'SYSTEM',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'WishlistItem',
      entityId: item.id,
      entityName: item.title,
      description: 'CRM product-backlog item updated',
      oldValue: existing,
      newValue: updateData,
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'LOW',
    })

    return NextResponse.json({ item })
  } catch (error) {
    console.error('CRM wishlist PUT error:', error)
    return NextResponse.json({ error: 'Failed to update wishlist item' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'wishlist:manage',
      level: 'sensitive',
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const itemId = new URL(request.url).searchParams.get('itemId') || ''
    if (!itemId || itemId.length > 128) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    const existing = await prisma.wishlistItem.findUnique({ where: { id: itemId } })
    if (!existing) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    await prisma.wishlistItem.delete({ where: { id: itemId } })

    await createAuditLog({
      action: 'DELETE',
      category: 'SYSTEM',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'WishlistItem',
      entityId: existing.id,
      entityName: existing.title,
      description: 'CRM product-backlog item deleted',
      oldValue: existing,
      newValue: { deleted: true },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'MEDIUM',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('CRM wishlist DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete wishlist item' }, { status: 500 })
  }
}
