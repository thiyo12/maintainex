import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'
import { checkRateLimit } from '@/lib/crm/rate-limit'
import { createAuditLog } from '@/lib/crm/audit'
import { canAccessCustomer } from '@/lib/crm/access-control'
import { communicationSchema, sanitizeInput } from '@/lib/crm/validation'

async function getClientIp(request: NextRequest): Promise<string> {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         request.headers.get('x-real-ip') || 
         'unknown'
}

const VALID_CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP', 'NOTIFICATION', 'CALL'] as const
const VALID_DIRECTIONS = ['OUTBOUND', 'INBOUND'] as const
const VALID_STATUSES = ['PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED'] as const

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
    const rateLimit = await checkRateLimit(clientIp, 'IP', '/api/customers/[id]/communications', 'GET')
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
    const channel = searchParams.get('channel')
    const direction = searchParams.get('direction')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const customer = await prisma.customerProfile.findUnique({
      where: { id },
      select: { id: true, province: true }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (!canAccessCustomer(session, customer.province)) {
      return NextResponse.json({ error: 'Access denied to this customer' }, { status: 403 })
    }

    const where: any = { customerId: id }

    if (channel && VALID_CHANNELS.includes(channel as any)) {
      where.channel = channel
    }
    if (direction && VALID_DIRECTIONS.includes(direction as any)) {
      where.direction = direction
    }
    if (status && VALID_STATUSES.includes(status as any)) {
      where.status = status
    }
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    const [communications, total] = await Promise.all([
      prisma.customerCommunication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customerCommunication.count({ where })
    ])

    await createAuditLog({
      action: 'VIEW',
      category: 'CUSTOMER',
      userId: session.id,
      userEmail: session.email,
      userRole: session.role,
      userProvince: session.province || undefined,
      entityType: 'CustomerCommunication',
      entityId: id,
      description: `Viewed customer communications (page ${page})`,
      ipAddress: clientIp,
      riskLevel: 'LOW',
    })

    return NextResponse.json({
      communications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    })
  } catch (error) {
    console.error('Error fetching customer communications:', error)
    return NextResponse.json({ error: 'Failed to fetch communications' }, { status: 500 })
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
    const rateLimit = await checkRateLimit(session.id, 'USER', '/api/customers/[id]/communications', 'POST', 'bulk')
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      }, { status: 429 })
    }

    const { id } = await params

    const customer = await prisma.customerProfile.findUnique({
      where: { id },
      select: { 
        id: true, 
        province: true, 
        user: { select: { name: true, email: true, phone: true } } 
      }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (!canAccessCustomer(session, customer.province)) {
      return NextResponse.json({ error: 'Access denied to this customer' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = communicationSchema.safeParse({ ...body, customerId: id })
    
    if (!parsed.success) {
      return NextResponse.json({ 
        error: 'Validation failed',
        details: parsed.error.errors 
      }, { status: 400 })
    }

    const { channel, direction, subject, content, status } = parsed.data

    const communication = await prisma.customerCommunication.create({
      data: {
        customerId: id,
        channel,
        direction,
        subject: subject ? sanitizeInput(subject) : null,
        content: sanitizeInput(content),
        status: status || 'PENDING',
        sentById: session.id,
        sentByEmail: session.email,
      }
    })

    const activityType = direction === 'OUTBOUND' ? `${channel}_SENT` : `${channel}_RECEIVED`
    await prisma.customerActivity.create({
      data: {
        customerId: id,
        type: activityType,
        title: `${direction === 'OUTBOUND' ? 'Sent' : 'Received'} ${channel}`,
        description: subject || content.substring(0, 100),
        relatedId: communication.id,
        relatedType: 'COMMUNICATION',
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
      entityType: 'CustomerCommunication',
      entityId: communication.id,
      entityName: customer.user.name,
      description: `Logged ${direction.toLowerCase()} ${channel.toLowerCase()} for ${customer.user.name}`,
      newValue: { channel, direction, subject, status },
      ipAddress: clientIp,
      riskLevel: 'MEDIUM',
    })

    return NextResponse.json(communication, { status: 201 })
  } catch (error) {
    console.error('Error creating customer communication:', error)
    return NextResponse.json({ error: 'Failed to create communication' }, { status: 500 })
  }
}
