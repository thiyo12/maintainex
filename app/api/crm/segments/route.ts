import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'
import { checkRateLimit } from '@/lib/crm/rate-limit'
import { createAuditLog } from '@/lib/crm/audit'
import { customerSegmentSchema } from '@/lib/crm/validation'

async function getClientIp(request: NextRequest): Promise<string> {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         request.headers.get('x-real-ip') || 
         'unknown'
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientIp = await getClientIp(request)
    const rateLimit = await checkRateLimit(clientIp, 'IP', '/api/crm/segments', 'GET')
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      }, { status: 429 })
    }

    const segments = await prisma.customerSegment.findMany({
      where: { isActive: true },
      orderBy: { memberCount: 'desc' },
    })

    await createAuditLog({
      action: 'VIEW',
      category: 'CRM_SEGMENT',
      userId: session.id,
      userEmail: session.email,
      userRole: session.role,
      userProvince: session.province || undefined,
      entityType: 'CustomerSegment',
      description: `Listed ${segments.length} segments`,
      ipAddress: clientIp,
      riskLevel: 'LOW',
    })

    return NextResponse.json({ segments })
  } catch (error) {
    console.error('Error fetching segments:', error)
    return NextResponse.json({ error: 'Failed to fetch segments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only SUPER_ADMIN can create segments' }, { status: 403 })
    }

    const clientIp = await getClientIp(request)
    const rateLimit = await checkRateLimit(session.id, 'USER', '/api/crm/segments', 'POST')
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      }, { status: 429 })
    }

    const body = await request.json()
    const parsed = customerSegmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ 
        error: 'Validation failed',
        details: parsed.error.errors 
      }, { status: 400 })
    }

    const { name, description, criteria, type } = parsed.data
    const slug = generateSlug(name)

    const existingSegment = await prisma.customerSegment.findFirst({
      where: {
        OR: [{ name }, { slug }]
      }
    })

    if (existingSegment) {
      return NextResponse.json({ error: 'Segment with this name already exists' }, { status: 409 })
    }

    const criteriaJson = JSON.stringify(criteria)

    const segment = await prisma.customerSegment.create({
      data: {
        name,
        slug,
        description: description || null,
        criteria: criteriaJson,
        type: type || 'DYNAMIC',
        isActive: true,
      }
    })

    await createAuditLog({
      action: 'CREATE',
      category: 'CRM_SEGMENT',
      userId: session.id,
      userEmail: session.email,
      userRole: session.role,
      userProvince: session.province || undefined,
      entityType: 'CustomerSegment',
      entityId: segment.id,
      entityName: name,
      description: `Created segment "${name}"`,
      newValue: { name, description, criteria, type },
      ipAddress: clientIp,
      riskLevel: 'HIGH',
    })

    return NextResponse.json({ segment }, { status: 201 })
  } catch (error) {
    console.error('Error creating segment:', error)
    return NextResponse.json({ error: 'Failed to create segment' }, { status: 500 })
  }
}