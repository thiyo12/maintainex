import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'
import { checkRateLimit } from '@/lib/crm/rate-limit'
import { createAuditLog } from '@/lib/crm/audit'
import { canAccessCustomer, getProvinceFilter } from '@/lib/crm/access-control'

async function getClientIp(request: NextRequest): Promise<string> {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         request.headers.get('x-real-ip') || 
         'unknown'
}

function applySegmentCriteria(
  criteria: Record<string, any>,
  where: any,
  superAdmin: boolean
): any {
  if (!criteria || Object.keys(criteria).length === 0) {
    return where
  }

  if (criteria.province && !superAdmin) {
    where.province = criteria.province
  }
  if (criteria.status) {
    where.status = criteria.status
  }
  if (criteria.customerType) {
    where.customerType = criteria.customerType
  }
  if (criteria.minBookings !== undefined) {
    where.totalBookings = { ...where.totalBookings, gte: criteria.minBookings }
  }
  if (criteria.maxBookings !== undefined) {
    where.totalBookings = { ...where.totalBookings, lte: criteria.maxBookings }
  }
  if (criteria.minSpent !== undefined) {
    where.totalSpent = { ...where.totalSpent, gte: criteria.minSpent }
  }
  if (criteria.maxSpent !== undefined) {
    where.totalSpent = { ...where.totalSpent, lte: criteria.maxSpent }
  }
  if (criteria.source) {
    where.source = criteria.source
  }
  if (criteria.dateFrom) {
    where.createdAt = { ...where.createdAt, gte: new Date(criteria.dateFrom) }
  }
  if (criteria.dateTo) {
    where.createdAt = { ...where.createdAt, lte: new Date(criteria.dateTo) }
  }

  return where
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
    const rateLimit = await checkRateLimit(clientIp, 'IP', `/api/crm/segments/${id}/customers`, 'GET')
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

    const criteria = JSON.parse(segment.criteria || '{}')
    const isDynamic = segment.type === 'DYNAMIC'
    const isSuperAdmin = session.role === 'SUPER_ADMIN'

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    let where: any = {}
    where = applySegmentCriteria(criteria, where, isSuperAdmin)

    if (!isSuperAdmin && session.province) {
      where.province = session.province
    }

    let customers: any[]
    let total: number

    if (isDynamic) {
      [customers, total] = await Promise.all([
        prisma.customerProfile.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                createdAt: true,
              }
            },
            tags: {
              where: { isActive: true },
              select: { id: true, name: true, color: true, slug: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.customerProfile.count({ where })
      ])
    } else {
      const segmentCustomers = await prisma.customerSegmentCustomer.findMany({
        where: { segmentId: id },
        include: {
          customer: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  createdAt: true,
                }
              },
              tags: {
                where: { isActive: true },
                select: { id: true, name: true, color: true, slug: true }
              }
            }
          }
        },
        orderBy: { addedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      })

      customers = segmentCustomers.map(sc => sc.customer)
      total = segment.memberCount
    }

    const filteredCustomers = customers.filter(c => 
      canAccessCustomer(session, c.province)
    )

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
      description: `Viewed ${filteredCustomers.length} customers in segment "${segment.name}"`,
      ipAddress: clientIp,
      riskLevel: 'LOW',
    })

    return NextResponse.json({
      customers: filteredCustomers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    })
  } catch (error) {
    console.error('Error fetching segment customers:', error)
    return NextResponse.json({ error: 'Failed to fetch segment customers' }, { status: 500 })
  }
}

export async function POST(
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
    const rateLimit = await checkRateLimit(session.id, 'USER', `/api/crm/segments/${id}/customers`, 'POST')
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

    const body = await request.json()
    const { customerId } = body

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 })
    }

    const customer = await prisma.customerProfile.findUnique({
      where: { id: customerId }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (!canAccessCustomer(session, customer.province)) {
      return NextResponse.json({ error: 'Access denied to this customer' }, { status: 403 })
    }

    const existingMember = await prisma.customerSegmentCustomer.findUnique({
      where: {
        customerId_segmentId: {
          customerId,
          segmentId: id
        }
      }
    })

    if (existingMember) {
      return NextResponse.json({ error: 'Customer already in this segment' }, { status: 409 })
    }

    await prisma.customerSegmentCustomer.create({
      data: {
        customerId,
        segmentId: id,
        addedBy: session.id
      }
    })

    await prisma.customerSegment.update({
      where: { id },
      data: { memberCount: { increment: 1 } }
    })

    await prisma.customerActivity.create({
      data: {
        customerId,
        type: 'SEGMENT_ADDED',
        title: 'Added to Segment',
        description: `Added to segment "${segment.name}" by ${session.email}`,
        createdById: session.id,
        createdByName: session.name || null,
        createdByEmail: session.email,
        ipAddress: clientIp,
      }
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
      description: `Added customer ${customerId} to segment "${segment.name}"`,
      newValue: { customerId, segmentId: id },
      ipAddress: clientIp,
      riskLevel: 'MEDIUM',
    })

    return NextResponse.json({ message: 'Customer added to segment' }, { status: 201 })
  } catch (error) {
    console.error('Error adding customer to segment:', error)
    return NextResponse.json({ error: 'Failed to add customer to segment' }, { status: 500 })
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

    if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params

    const clientIp = await getClientIp(request)
    const rateLimit = await checkRateLimit(session.id, 'USER', `/api/crm/segments/${id}/customers`, 'DELETE')
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

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')

    if (!customerId) {
      return NextResponse.json({ error: 'customerId query parameter is required' }, { status: 400 })
    }

    const customer = await prisma.customerProfile.findUnique({
      where: { id: customerId }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (!canAccessCustomer(session, customer.province)) {
      return NextResponse.json({ error: 'Access denied to this customer' }, { status: 403 })
    }

    const existingMember = await prisma.customerSegmentCustomer.findUnique({
      where: {
        customerId_segmentId: {
          customerId,
          segmentId: id
        }
      }
    })

    if (!existingMember) {
      return NextResponse.json({ error: 'Customer not in this segment' }, { status: 404 })
    }

    await prisma.customerSegmentCustomer.delete({
      where: {
        customerId_segmentId: {
          customerId,
          segmentId: id
        }
      }
    })

    await prisma.customerSegment.update({
      where: { id },
      data: { memberCount: { decrement: 1 } }
    })

    await prisma.customerActivity.create({
      data: {
        customerId,
        type: 'SEGMENT_REMOVED',
        title: 'Removed from Segment',
        description: `Removed from segment "${segment.name}" by ${session.email}`,
        createdById: session.id,
        createdByName: session.name || null,
        createdByEmail: session.email,
        ipAddress: clientIp,
      }
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
      description: `Removed customer ${customerId} from segment "${segment.name}"`,
      oldValue: { customerId, segmentId: id },
      ipAddress: clientIp,
      riskLevel: 'MEDIUM',
    })

    return NextResponse.json({ message: 'Customer removed from segment' })
  } catch (error) {
    console.error('Error removing customer from segment:', error)
    return NextResponse.json({ error: 'Failed to remove customer from segment' }, { status: 500 })
  }
}