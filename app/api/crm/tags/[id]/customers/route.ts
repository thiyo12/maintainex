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
    const rateLimit = await checkRateLimit(clientIp, 'IP', `/api/crm/tags/${id}/customers`, 'GET')
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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const provinceFilter = getProvinceFilter(session)

    const [customers, total] = await Promise.all([
      prisma.customerProfile.findMany({
        where: {
          tags: { some: { id } },
          ...provinceFilter
        },
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
      prisma.customerProfile.count({
        where: {
          tags: { some: { id } },
          ...provinceFilter
        }
      })
    ])

    const filteredCustomers = customers.filter(c => 
      canAccessCustomer(session, c.province)
    )

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
      description: `Viewed ${filteredCustomers.length} customers for tag "${tag.name}"`,
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
    console.error('Error fetching tag customers:', error)
    return NextResponse.json({ error: 'Failed to fetch tag customers' }, { status: 500 })
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
    const rateLimit = await checkRateLimit(session.id, 'USER', `/api/crm/tags/${id}/customers`, 'POST')
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

    const hasTag = await prisma.customerProfile.findFirst({
      where: {
        id: customerId,
        tags: { some: { id } }
      }
    })

    if (hasTag) {
      return NextResponse.json({ error: 'Customer already has this tag' }, { status: 409 })
    }

    await prisma.customerProfile.update({
      where: { id: customerId },
      data: {
        tags: { connect: { id } }
      }
    })

    await prisma.customerTag.update({
      where: { id },
      data: { usageCount: { increment: 1 } }
    })

    await prisma.customerActivity.create({
      data: {
        customerId,
        type: 'TAG_ADDED',
        title: 'Tag Added',
        description: `Tag "${tag.name}" added by ${session.email}`,
        createdById: session.id,
        createdByName: session.name || null,
        createdByEmail: session.email,
        ipAddress: clientIp,
      }
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
      description: `Added customer ${customerId} to tag "${tag.name}"`,
      newValue: { customerId, tagId: id },
      ipAddress: clientIp,
      riskLevel: 'MEDIUM',
    })

    return NextResponse.json({ message: 'Customer added to tag' }, { status: 201 })
  } catch (error) {
    console.error('Error adding customer to tag:', error)
    return NextResponse.json({ error: 'Failed to add customer to tag' }, { status: 500 })
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
    const rateLimit = await checkRateLimit(session.id, 'USER', `/api/crm/tags/${id}/customers`, 'DELETE')
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

    const hasTag = await prisma.customerProfile.findFirst({
      where: {
        id: customerId,
        tags: { some: { id } }
      }
    })

    if (!hasTag) {
      return NextResponse.json({ error: 'Customer does not have this tag' }, { status: 404 })
    }

    await prisma.customerProfile.update({
      where: { id: customerId },
      data: {
        tags: { disconnect: { id } }
      }
    })

    await prisma.customerTag.update({
      where: { id },
      data: { usageCount: { decrement: 1 } }
    })

    await prisma.customerActivity.create({
      data: {
        customerId,
        type: 'TAG_REMOVED',
        title: 'Tag Removed',
        description: `Tag "${tag.name}" removed by ${session.email}`,
        createdById: session.id,
        createdByName: session.name || null,
        createdByEmail: session.email,
        ipAddress: clientIp,
      }
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
      description: `Removed customer ${customerId} from tag "${tag.name}"`,
      oldValue: { customerId, tagId: id },
      ipAddress: clientIp,
      riskLevel: 'MEDIUM',
    })

    return NextResponse.json({ message: 'Customer removed from tag' })
  } catch (error) {
    console.error('Error removing customer from tag:', error)
    return NextResponse.json({ error: 'Failed to remove customer from tag' }, { status: 500 })
  }
}