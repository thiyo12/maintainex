import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, SessionUser } from '@/lib/auth-utils'
import { checkRateLimit } from '@/lib/crm/rate-limit'
import { createAuditLog } from '@/lib/crm/audit'
import { customerSearchSchema, customerCreateSchema, sanitizeInput, sanitizePhone, validateEmail, validatePhone } from '@/lib/crm/validation'
import { getProvinceFilter, canAccessAllCustomers } from '@/lib/crm/access-control'
import { logActivity } from '@/lib/activity-log'

async function getClientIp(request: NextRequest): Promise<string> {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         request.headers.get('x-real-ip') || 
         'unknown'
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientIp = await getClientIp(request)
    const rateLimit = await checkRateLimit(clientIp, 'IP', '/api/customers', 'GET')
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const queryParams = {
      query: searchParams.get('query') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
      status: searchParams.get('status') || undefined,
      customerType: searchParams.get('customerType') || undefined,
      province: searchParams.get('province') || undefined,
      source: searchParams.get('source') || undefined,
      minBookings: searchParams.get('minBookings') || undefined,
      maxBookings: searchParams.get('maxBookings') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
    }

    const parsed = customerSearchSchema.safeParse(queryParams)
    if (!parsed.success) {
      return NextResponse.json({ 
        error: 'Invalid query parameters',
        details: parsed.error.errors 
      }, { status: 400 })
    }

    const { query, page, limit, sortBy, sortOrder, status, customerType, province, source, minBookings, maxBookings, dateFrom, dateTo } = parsed.data

    const where: any = {}
    
    if (query) {
      where.OR = [
        { user: { name: { contains: query, mode: 'insensitive' } } },
        { user: { email: { contains: query, mode: 'insensitive' } } },
        { user: { phone: { contains: query, mode: 'insensitive' } } },
      ]
    }

    if (status) where.status = status
    if (customerType) where.customerType = customerType
    if (source) where.source = source

    if (minBookings !== undefined) where.totalBookings = { ...where.totalBookings, gte: minBookings }
    if (maxBookings !== undefined) where.totalBookings = { ...where.totalBookings, lte: maxBookings }

    if (dateFrom) where.createdAt = { ...where.createdAt, gte: new Date(dateFrom) }
    if (dateTo) where.createdAt = { ...where.createdAt, lte: new Date(dateTo) }

    if (!canAccessAllCustomers(session)) {
      if (province && province !== session.province) {
        return NextResponse.json({ error: 'Access denied to this province' }, { status: 403 })
      }
      if (session.province) {
        where.province = session.province
      }
    } else if (province) {
      where.province = province
    }

    const [customers, total] = await Promise.all([
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
          },
          _count: {
            select: { notes: true, activities: true }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customerProfile.count({ where })
    ])

    await createAuditLog({
      action: 'VIEW',
      category: 'CUSTOMER',
      userId: session.id,
      userEmail: session.email,
      userRole: session.role,
      userProvince: session.province || undefined,
      entityType: 'CustomerProfile',
      description: `Listed ${customers.length} customers (page ${page})`,
      ipAddress: clientIp,
      riskLevel: 'LOW',
    })

    return NextResponse.json({
      customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const clientIp = await getClientIp(request)
    const rateLimit = await checkRateLimit(session.id, 'USER', '/api/customers', 'POST')
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      }, { status: 429 })
    }

    const body = await request.json()
    const parsed = customerCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ 
        error: 'Validation failed',
        details: parsed.error.errors 
      }, { status: 400 })
    }

    const { name, email, phone, customerType, status, preferredContact, source, sourceDetails, province, notes } = parsed.data

    if (email && !validateEmail(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    if (phone && !validatePhone(phone)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    if (!canAccessAllCustomers(session) && province && province !== session.province) {
      return NextResponse.json({ error: 'Cannot create customer in different province' }, { status: 403 })
    }

    let userId: string
    let existingCustomer: any

    if (email) {
      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (existingUser) {
        existingCustomer = await prisma.customerProfile.findUnique({ where: { userId: existingUser.id } })
        if (existingCustomer) {
          return NextResponse.json({ 
            error: 'Customer profile already exists for this user',
            customerId: existingCustomer.id 
          }, { status: 409 })
        }
        userId = existingUser.id
      } else {
        const user = await prisma.user.create({
          data: {
            email,
            name: sanitizeInput(name),
            phone: phone ? sanitizePhone(phone) : null,
            passwordHash: 'CRM_CREATED',
            role: 'CUSTOMER',
          }
        })
        userId = user.id
      }
    } else if (phone) {
      const existingUser = await prisma.user.findFirst({ 
        where: { phone: sanitizePhone(phone) } 
      })
      if (existingUser) {
        existingCustomer = await prisma.customerProfile.findUnique({ where: { userId: existingUser.id } })
        if (existingCustomer) {
          return NextResponse.json({ 
            error: 'Customer profile already exists for this phone number',
            customerId: existingCustomer.id 
          }, { status: 409 })
        }
        userId = existingUser.id
      } else {
        const user = await prisma.user.create({
          data: {
            email: `phone_${Date.now()}@placeholder.com`,
            name: sanitizeInput(name),
            phone: sanitizePhone(phone),
            passwordHash: 'CRM_CREATED',
            role: 'CUSTOMER',
          }
        })
        userId = user.id
      }
    } else {
      return NextResponse.json({ error: 'Email or phone is required' }, { status: 400 })
    }

    const customer = await prisma.customerProfile.create({
      data: {
        userId,
        customerType: customerType || 'REGULAR',
        status: status || 'ACTIVE',
        preferredContact: preferredContact || null,
        source: source || null,
        sourceDetails: sourceDetails ? sanitizeInput(sourceDetails) : null,
        province: province || session.province || null,
        summary: notes ? sanitizeInput(notes) : null,
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
      }
    })

    await prisma.customerActivity.create({
      data: {
        customerId: customer.id,
        type: 'PROFILE_CREATED',
        title: 'Customer Profile Created',
        description: `Customer profile created by ${session.email}`,
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
      entityType: 'CustomerProfile',
      entityId: customer.id,
      entityName: name,
      description: `Created customer profile for ${name}`,
      newValue: { name, email, phone, customerType, status, province },
      ipAddress: clientIp,
      riskLevel: 'MEDIUM',
    })

    await logActivity({
      adminId: session.id,
      adminEmail: session.email,
      adminName: session.name,
      branchId: session.branchId,
      action: 'CREATE',
      entityType: 'CUSTOMER' as any,
      entityId: customer.id,
      description: `Created customer profile for ${name}`,
      details: { name, email, customerType, status } as any
    })

    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    console.error('Error creating customer:', error)
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
  }
}
