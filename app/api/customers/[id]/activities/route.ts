import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'
import { checkRateLimit } from '@/lib/crm/rate-limit'
import { createAuditLog } from '@/lib/crm/audit'
import { canAccessCustomer } from '@/lib/crm/access-control'

async function getClientIp(request: NextRequest): Promise<string> {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         request.headers.get('x-real-ip') || 
         'unknown'
}

const ACTIVITY_TYPES = [
  'BOOKING_CREATED',
  'BOOKING_CONFIRMED',
  'BOOKING_IN_PROGRESS',
  'BOOKING_COMPLETED',
  'BOOKING_CANCELLED',
  'CALL_MADE',
  'CALL_RECEIVED',
  'EMAIL_SENT',
  'EMAIL_OPENED',
  'WHATSAPP_SENT',
  'WHATSAPP_RECEIVED',
  'NOTE_ADDED',
  'TAG_ADDED',
  'TAG_REMOVED',
  'SEGMENT_ADDED',
  'SEGMENT_REMOVED',
  'STATUS_CHANGED',
  'PROFILE_UPDATED',
  'ADDRESS_ADDED',
  'ADDRESS_UPDATED',
  'COMMUNICATION_SENT',
  'COMMUNICATION_RECEIVED',
  'LOGIN',
  'PASSWORD_RESET',
  'CONSENT_UPDATED',
  'PREFERENCES_UPDATED',
] as const

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientIp = await getClientIp(request)
    const rateLimit = await checkRateLimit(clientIp, 'IP', '/api/customers/[id]/activities', 'GET')
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      }, { status: 429 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const type = searchParams.get('type')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const customer = await prisma.customerProfile.findUnique({
      where: { id },
      include: { 
        user: { select: { name: true } }
      }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (!canAccessCustomer(session, customer.province)) {
      return NextResponse.json({ error: 'Access denied to this customer' }, { status: 403 })
    }

    const where: any = { customerId: id }
    if (type && ACTIVITY_TYPES.includes(type as any)) {
      where.type = type
    }
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    const [activities, total] = await Promise.all([
      prisma.customerActivity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customerActivity.count({ where })
    ])

    await createAuditLog({
      action: 'VIEW',
      category: 'CUSTOMER',
      userId: session.id,
      userEmail: session.email,
      userRole: session.role,
      userProvince: session.province || undefined,
      entityType: 'CustomerActivity',
      entityId: id,
      description: `Viewed customer activities (page ${page})`,
      ipAddress: clientIp,
      riskLevel: 'LOW',
    })

    return NextResponse.json({
      activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    })
  } catch (error) {
    console.error('Error fetching customer activities:', error)
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
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

    const clientIp = await getClientIp(request)
    const rateLimit = await checkRateLimit(session.id, 'USER', '/api/customers/[id]/activities', 'POST')
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      }, { status: 429 })
    }

    const { id } = await params

    const customer = await prisma.customerProfile.findUnique({
      where: { id },
      include: { user: { select: { name: true } } }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (!canAccessCustomer(session, customer.province)) {
      return NextResponse.json({ error: 'Access denied to this customer' }, { status: 403 })
    }

    const body = await request.json()
    const { type, title, description, metadata, relatedId, relatedType } = body

    if (!type || !title) {
      return NextResponse.json({ 
        error: 'Activity type and title are required' 
      }, { status: 400 })
    }

    if (!ACTIVITY_TYPES.includes(type)) {
      return NextResponse.json({ 
        error: `Invalid activity type. Valid types: ${ACTIVITY_TYPES.join(', ')}` 
      }, { status: 400 })
    }

    const activity = await prisma.customerActivity.create({
      data: {
        customerId: id,
        type,
        title: title.substring(0, 200),
        description: description ? description.substring(0, 1000) : null,
        metadata: metadata ? JSON.stringify(metadata).substring(0, 2000) : null,
        relatedId: relatedId || null,
        relatedType: relatedType || null,
        createdById: session.id,
        createdByName: session.name || null,
        createdByEmail: session.email,
        ipAddress: clientIp,
      }
    })

    await createAuditLog({
      action: 'CREATE',
      category: 'CUSTOMER',
      userId: session.id,
      userEmail: session.email,
      userRole: session.role,
      userProvince: session.province || undefined,
      entityType: 'CustomerActivity',
      entityId: activity.id,
      entityName: customer.user.name,
      description: `Added ${type} activity for ${customer.user.name}`,
      newValue: { type, title, description },
      ipAddress: clientIp,
      riskLevel: 'LOW',
    })

    return NextResponse.json(activity, { status: 201 })
  } catch (error) {
    console.error('Error creating customer activity:', error)
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 })
  }
}
