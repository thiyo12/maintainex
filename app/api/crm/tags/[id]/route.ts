import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'
import { checkRateLimit } from '@/lib/crm/rate-limit'
import { createAuditLog } from '@/lib/crm/audit'

async function getClientIp(request: NextRequest): Promise<string> {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         request.headers.get('x-real-ip') || 
         'unknown'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const clientIp = await getClientIp(request)
    const rateLimit = await checkRateLimit(clientIp, 'IP', `/api/crm/tags/${id}`, 'GET')
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      }, { status: 429 })
    }

    const tag = await prisma.customerTag.findUnique({
      where: { id },
      include: {
        customers: {
          take: 100,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              }
            }
          }
        }
      }
    })

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    await createAuditLog({
      action: 'VIEW',
      category: 'CRM_TAG',
      userId: session.id,
      userEmail: session.email,
      userRole: session.role,
      userProvince: session.province || undefined,
      entityType: 'CustomerTag',
      entityId: tag.id,
      entityName: tag.name,
      description: `Viewed tag "${tag.name}" details`,
      ipAddress: clientIp,
      riskLevel: 'LOW',
    })

    return NextResponse.json({ tag })
  } catch (error) {
    console.error('Error fetching tag:', error)
    return NextResponse.json({ error: 'Failed to fetch tag' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params

    const clientIp = await getClientIp(request)
    const rateLimit = await checkRateLimit(session.id, 'USER', `/api/crm/tags/${id}`, 'PUT')
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      }, { status: 429 })
    }

    const body = await request.json()
    const { name, color, description } = body

    const existingTag = await prisma.customerTag.findUnique({
      where: { id }
    })

    if (!existingTag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    if (name && name !== existingTag.name) {
      const duplicateTag = await prisma.customerTag.findFirst({
        where: {
          OR: [{ name }, { slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }],
          NOT: { id }
        }
      })
      if (duplicateTag) {
        return NextResponse.json({ error: 'Tag name already exists' }, { status: 409 })
      }
    }

    const updateData: any = {}
    if (name) updateData.name = name
    if (color) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return NextResponse.json({ error: 'Invalid color format' }, { status: 400 })
      }
      updateData.color = color
    }
    if (description !== undefined) updateData.description = description

    const tag = await prisma.customerTag.update({
      where: { id },
      data: updateData
    })

    await createAuditLog({
      action: 'UPDATE',
      category: 'CRM_TAG',
      userId: session.id,
      userEmail: session.email,
      userRole: session.role,
      userProvince: session.province || undefined,
      entityType: 'CustomerTag',
      entityId: tag.id,
      entityName: tag.name,
      description: `Updated tag "${tag.name}"`,
      oldValue: existingTag,
      newValue: tag,
      ipAddress: clientIp,
      riskLevel: 'MEDIUM',
    })

    return NextResponse.json({ tag })
  } catch (error) {
    console.error('Error updating tag:', error)
    return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 })
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

    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only SUPER_ADMIN can delete tags' }, { status: 403 })
    }

    const { id } = await params

    const clientIp = await getClientIp(request)
    const rateLimit = await checkRateLimit(session.id, 'USER', `/api/crm/tags/${id}`, 'DELETE')
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      }, { status: 429 })
    }

    const tag = await prisma.customerTag.findUnique({
      where: { id }
    })

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    if (tag.isSystem) {
      return NextResponse.json({ error: 'Cannot delete system tags' }, { status: 403 })
    }

    await prisma.$transaction([
      prisma.customerTag.update({
        where: { id },
        data: { isActive: false }
      }),
      prisma.customerProfile.updateMany({
        where: {
          tags: {
            some: { id }
          }
        },
        data: {
          totalBookings: { decrement: 0 }
        }
      })
    ])

    const updatedTag = await prisma.customerTag.update({
      where: { id },
      data: { isActive: false }
    })

    await createAuditLog({
      action: 'DELETE',
      category: 'CRM_TAG',
      userId: session.id,
      userEmail: session.email,
      userRole: session.role,
      userProvince: session.province || undefined,
      entityType: 'CustomerTag',
      entityId: id,
      entityName: tag.name,
      description: `Deleted tag "${tag.name}"`,
      oldValue: tag,
      ipAddress: clientIp,
      riskLevel: 'HIGH',
    })

    return NextResponse.json({ message: 'Tag deleted successfully', tag: updatedTag })
  } catch (error) {
    console.error('Error deleting tag:', error)
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 })
  }
}