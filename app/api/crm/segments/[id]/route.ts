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
    const rateLimit = await checkRateLimit(clientIp, 'IP', `/api/crm/segments/${id}`, 'GET')
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      }, { status: 429 })
    }

    const segment = await prisma.customerSegment.findUnique({
      where: { id },
      include: {
        customers: {
          take: 10,
          orderBy: { addedAt: 'desc' },
          include: {
            customer: {
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
        }
      }
    })

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
    }

    const parsedCriteria = JSON.parse(segment.criteria || '{}')

    await createAuditLog({
      action: 'VIEW',
      category: 'CRM_SEGMENT',
      userId: session.id,
      userEmail: session.email,
      userRole: session.role,
      userProvince: session.province || undefined,
      entityType: 'CustomerSegment',
      entityId: segment.id,
      entityName: segment.name,
      description: `Viewed segment "${segment.name}" details`,
      ipAddress: clientIp,
      riskLevel: 'LOW',
    })

    return NextResponse.json({ 
      segment: {
        ...segment,
        criteria: parsedCriteria
      }
    })
  } catch (error) {
    console.error('Error fetching segment:', error)
    return NextResponse.json({ error: 'Failed to fetch segment' }, { status: 500 })
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

    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only SUPER_ADMIN can update segments' }, { status: 403 })
    }

    const { id } = await params

    const clientIp = await getClientIp(request)
    const rateLimit = await checkRateLimit(session.id, 'USER', `/api/crm/segments/${id}`, 'PUT')
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      }, { status: 429 })
    }

    const existingSegment = await prisma.customerSegment.findUnique({
      where: { id }
    })

    if (!existingSegment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, description, criteria } = body

    const updateData: any = {}
    if (name && name !== existingSegment.name) {
      const duplicateSegment = await prisma.customerSegment.findFirst({
        where: {
          OR: [{ name }, { slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }],
          NOT: { id }
        }
      })
      if (duplicateSegment) {
        return NextResponse.json({ error: 'Segment name already exists' }, { status: 409 })
      }
      updateData.name = name
    }
    if (description !== undefined) updateData.description = description
    if (criteria) {
      try {
        JSON.stringify(criteria)
        updateData.criteria = JSON.stringify(criteria)
      } catch {
        return NextResponse.json({ error: 'Invalid criteria format' }, { status: 400 })
      }
    }

    const segment = await prisma.customerSegment.update({
      where: { id },
      data: updateData
    })

    await createAuditLog({
      action: 'UPDATE',
      category: 'CRM_SEGMENT',
      userId: session.id,
      userEmail: session.email,
      userRole: session.role,
      userProvince: session.province || undefined,
      entityType: 'CustomerSegment',
      entityId: segment.id,
      entityName: segment.name,
      description: `Updated segment "${segment.name}" criteria`,
      oldValue: existingSegment,
      newValue: segment,
      ipAddress: clientIp,
      riskLevel: 'HIGH',
    })

    return NextResponse.json({ 
      segment: {
        ...segment,
        criteria: JSON.parse(segment.criteria || '{}')
      }
    })
  } catch (error) {
    console.error('Error updating segment:', error)
    return NextResponse.json({ error: 'Failed to update segment' }, { status: 500 })
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
      return NextResponse.json({ error: 'Only SUPER_ADMIN can delete segments' }, { status: 403 })
    }

    const { id } = await params

    const clientIp = await getClientIp(request)
    const rateLimit = await checkRateLimit(session.id, 'USER', `/api/crm/segments/${id}`, 'DELETE')
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      }, { status: 429 })
    }

    const segment = await prisma.customerSegment.findUnique({
      where: { id }
    })

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
    }

    await prisma.customerSegment.update({
      where: { id },
      data: { isActive: false }
    })

    await createAuditLog({
      action: 'DELETE',
      category: 'CRM_SEGMENT',
      userId: session.id,
      userEmail: session.email,
      userRole: session.role,
      userProvince: session.province || undefined,
      entityType: 'CustomerSegment',
      entityId: id,
      entityName: segment.name,
      description: `Deleted segment "${segment.name}"`,
      oldValue: segment,
      ipAddress: clientIp,
      riskLevel: 'HIGH',
    })

    return NextResponse.json({ message: 'Segment deleted successfully' })
  } catch (error) {
    console.error('Error deleting segment:', error)
    return NextResponse.json({ error: 'Failed to delete segment' }, { status: 500 })
  }
}