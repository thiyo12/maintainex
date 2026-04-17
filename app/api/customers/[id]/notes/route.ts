import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'
import { checkRateLimit } from '@/lib/crm/rate-limit'
import { createAuditLog } from '@/lib/crm/audit'
import { canAccessCustomer } from '@/lib/crm/access-control'
import { customerNoteSchema, sanitizeInput } from '@/lib/crm/validation'

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

    const clientIp = await getClientIp(request)
    const rateLimit = await checkRateLimit(clientIp, 'IP', '/api/customers/[id]/notes', 'GET')
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
    const includePrivate = searchParams.get('includePrivate') === 'true'

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
    
    if (type) {
      where.type = type
    }

    if (!includePrivate || session.role !== 'SUPER_ADMIN') {
      where.OR = [
        { isPrivate: false },
        { createdById: session.id }
      ]
    }

    const [notes, total] = await Promise.all([
      prisma.customerNote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customerNote.count({ where })
    ])

    await createAuditLog({
      action: 'VIEW',
      category: 'CUSTOMER',
      userId: session.id,
      userEmail: session.email,
      userRole: session.role,
      userProvince: session.province || undefined,
      entityType: 'CustomerNote',
      entityId: id,
      description: `Viewed customer notes (page ${page})`,
      ipAddress: clientIp,
      riskLevel: 'LOW',
    })

    return NextResponse.json({
      notes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    })
  } catch (error) {
    console.error('Error fetching customer notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
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
    const rateLimit = await checkRateLimit(session.id, 'USER', '/api/customers/[id]/notes', 'POST')
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      }, { status: 429 })
    }

    const { id } = await params

    const customer = await prisma.customerProfile.findUnique({
      where: { id },
      select: { id: true, province: true, user: { select: { name: true } } }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (!canAccessCustomer(session, customer.province)) {
      return NextResponse.json({ error: 'Access denied to this customer' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = customerNoteSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json({ 
        error: 'Validation failed',
        details: parsed.error.errors 
      }, { status: 400 })
    }

    const { content, type, isPrivate } = parsed.data

    const note = await prisma.customerNote.create({
      data: {
        customerId: id,
        content: sanitizeInput(content),
        type: type || 'GENERAL',
        isPrivate: isPrivate ?? false,
        createdById: session.id,
        createdByName: session.name || null,
      }
    })

    await prisma.customerActivity.create({
      data: {
        customerId: id,
        type: 'NOTE_ADDED',
        title: `Note Added (${type || 'GENERAL'})`,
        description: content.substring(0, 200),
        relatedId: note.id,
        relatedType: 'NOTE',
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
      entityType: 'CustomerNote',
      entityId: note.id,
      entityName: customer.user.name,
      description: `Added ${type || 'GENERAL'} note for ${customer.user.name}`,
      newValue: { content, type, isPrivate },
      ipAddress: clientIp,
      riskLevel: 'LOW',
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error('Error creating customer note:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}
