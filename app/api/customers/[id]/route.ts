import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'
import { checkRateLimit } from '@/lib/crm/rate-limit'
import { createAuditLog } from '@/lib/crm/audit'
import { customerUpdateSchema, sanitizeInput, sanitizePhone, validateEmail, validatePhone } from '@/lib/crm/validation'
import { canAccessCustomer } from '@/lib/crm/access-control'
import { logActivity } from '@/lib/activity-log'

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
    const rateLimit = await checkRateLimit(clientIp, 'IP', '/api/customers/[id]', 'GET')
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      }, { status: 429 })
    }

    const { id } = await params

    const customer = await prisma.customerProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          }
        },
        tags: {
          where: { isActive: true },
          select: { id: true, name: true, color: true, slug: true, type: true }
        },
        addresses: {
          where: { isActive: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
        },
        notes: {
          where: {
            OR: [
              { isPrivate: false },
              { createdById: session.id }
            ]
          },
          orderBy: { createdAt: 'desc' },
          take: 20
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 50
        },
        segments: {
          include: {
            segment: {
              select: { id: true, name: true, slug: true }
            }
          }
        },
        _count: {
          select: { 
            notes: true, 
            activities: true, 
            communications: true,
            addresses: true,
          }
        }
      }
    }) as any

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const recentBookingsRaw = await prisma.booking.findMany({
      where: { userId: customer.userId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        date: true,
        totalPrice: true,
        serviceId: true
      }
    })
    
    const recentBookings = await Promise.all(recentBookingsRaw.map(async (booking: any) => {
      let service = null
      if (booking.serviceId) {
        service = await prisma.service.findUnique({
          where: { id: booking.serviceId },
          select: { id: true, name: true }
        })
      }
      return { ...booking, service }
    }))

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (!canAccessCustomer(session, customer.province)) {
      return NextResponse.json({ error: 'Access denied to this customer' }, { status: 403 })
    }

    await createAuditLog({
      action: 'VIEW',
      category: 'CUSTOMER',
      userId: session.id,
      userEmail: session.email,
      userRole: session.role,
      userProvince: session.province || undefined,
      entityType: 'CustomerProfile',
      entityId: customer.id,
      entityName: customer.user.name,
      description: `Viewed customer profile for ${customer.user.name}`,
      ipAddress: clientIp,
      riskLevel: 'LOW',
    })

    return NextResponse.json({
      ...customer,
      recentBookings,
    })
  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 })
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

    const clientIp = await getClientIp(request)
    const rateLimit = await checkRateLimit(session.id, 'USER', '/api/customers/[id]', 'PUT')
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      }, { status: 429 })
    }

    const { id } = await params

    const existingCustomer = await prisma.customerProfile.findUnique({
      where: { id },
      include: { user: true }
    })

    if (!existingCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (!canAccessCustomer(session, existingCustomer.province)) {
      return NextResponse.json({ error: 'Access denied to this customer' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = customerUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ 
        error: 'Validation failed',
        details: parsed.error.errors 
      }, { status: 400 })
    }

    const updateData = parsed.data
    const oldValues: any = {}

    if (updateData.email !== undefined && updateData.email !== existingCustomer.user.email) {
      if (!validateEmail(updateData.email)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
      }
      const emailExists = await prisma.user.findFirst({
        where: { email: updateData.email, NOT: { id: existingCustomer.userId } }
      })
      if (emailExists) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
      }
    }

    if (updateData.phone !== undefined) {
      if (!validatePhone(updateData.phone)) {
        return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
      }
    }

    const userUpdates: any = {}
    if (updateData.name !== undefined) {
      oldValues.name = existingCustomer.user.name
      userUpdates.name = sanitizeInput(updateData.name)
    }
    if (updateData.email !== undefined) {
      oldValues.email = existingCustomer.user.email
      userUpdates.email = updateData.email
    }
    if (updateData.phone !== undefined) {
      oldValues.phone = existingCustomer.user.phone
      userUpdates.phone = sanitizePhone(updateData.phone)
    }

    const profileUpdates: any = {}
    if (updateData.customerType !== undefined) {
      oldValues.customerType = existingCustomer.customerType
      profileUpdates.customerType = updateData.customerType
    }
    if (updateData.status !== undefined) {
      oldValues.status = existingCustomer.status
      profileUpdates.status = updateData.status
      if (updateData.status === 'BLACKLISTED' && existingCustomer.status !== 'BLACKLISTED') {
        profileUpdates.blacklistDate = new Date()
        profileUpdates.blacklistReason = body.blacklistReason ? sanitizeInput(body.blacklistReason) : null
      }
    }
    if (updateData.preferredContact !== undefined) {
      oldValues.preferredContact = existingCustomer.preferredContact
      profileUpdates.preferredContact = updateData.preferredContact
    }
    if (updateData.source !== undefined) {
      oldValues.source = existingCustomer.source
      profileUpdates.source = updateData.source
    }
    if (updateData.sourceDetails !== undefined) {
      oldValues.sourceDetails = existingCustomer.sourceDetails
      profileUpdates.sourceDetails = sanitizeInput(updateData.sourceDetails)
    }
    if (updateData.province !== undefined) {
      if (!canAccessCustomer(session, updateData.province)) {
        return NextResponse.json({ error: 'Cannot move customer to different province' }, { status: 403 })
      }
      oldValues.province = existingCustomer.province
      profileUpdates.province = updateData.province
    }
    if (updateData.notes !== undefined) {
      oldValues.summary = existingCustomer.summary
      profileUpdates.summary = sanitizeInput(updateData.notes)
    }

    if (Object.keys(userUpdates).length > 0) {
      await prisma.user.update({
        where: { id: existingCustomer.userId },
        data: userUpdates
      })
    }

    if (Object.keys(profileUpdates).length > 0) {
      await prisma.customerProfile.update({
        where: { id },
        data: profileUpdates
      })
    }

    const hasSignificantChanges = ['status', 'customerType', 'blacklistReason'].some(
      key => Object.prototype.hasOwnProperty.call(oldValues, key)
    )
    
    const riskLevel = hasSignificantChanges ? 'HIGH' : 'MEDIUM'

    await prisma.customerActivity.create({
      data: {
        customerId: id,
        type: 'PROFILE_UPDATED',
        title: 'Profile Updated',
        description: `Customer profile updated by ${session.email}`,
        metadata: JSON.stringify({ oldValues, newValues: updateData }),
        createdById: session.id,
        createdByName: session.name || null,
        createdByEmail: session.email,
        ipAddress: clientIp,
      }
    })

    await createAuditLog({
      action: 'UPDATE',
      category: 'CUSTOMER',
      userId: session.id,
      userEmail: session.email,
      userRole: session.role,
      userProvince: session.province || undefined,
      entityType: 'CustomerProfile',
      entityId: id,
      entityName: existingCustomer.user.name,
      description: `Updated customer profile for ${existingCustomer.user.name}`,
      oldValue: oldValues,
      newValue: updateData,
      ipAddress: clientIp,
      riskLevel,
    })

    await logActivity({
      adminId: session.id,
      adminEmail: session.email,
      adminName: session.name,
      branchId: session.branchId,
      action: 'UPDATE',
      entityType: 'CUSTOMER' as any,
      entityId: id,
      description: `Updated customer ${existingCustomer.user.name}`,
      details: { changedFields: Object.keys(updateData) } as any
    })

    const updatedCustomer = await prisma.customerProfile.findUnique({
      where: { id },
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
          select: { id: true, name: true, color: true }
        },
      }
    })

    return NextResponse.json(updatedCustomer)
  } catch (error) {
    console.error('Error updating customer:', error)
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 })
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

    const clientIp = await getClientIp(request)
    const rateLimit = await checkRateLimit(session.id, 'USER', '/api/customers/[id]', 'DELETE')
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      }, { status: 429 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const hardDelete = searchParams.get('hardDelete') === 'true'

    const customer = await prisma.customerProfile.findUnique({
      where: { id },
      include: { user: true }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (!canAccessCustomer(session, customer.province)) {
      return NextResponse.json({ error: 'Access denied to this customer' }, { status: 403 })
    }

    if (hardDelete) {
      if (session.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ 
          error: 'Hard delete requires SUPER_ADMIN privileges' 
        }, { status: 403 })
      }

      await prisma.customerProfile.delete({
        where: { id }
      })

      await createAuditLog({
        action: 'DELETE',
        category: 'CUSTOMER',
        userId: session.id,
        userEmail: session.email,
        userRole: session.role,
        userProvince: session.province || undefined,
        entityType: 'CustomerProfile',
        entityId: id,
        entityName: customer.user.name,
        description: `Hard deleted customer profile for ${customer.user.name}`,
        oldValue: { 
          id: customer.id, 
          userId: customer.userId,
          name: customer.user.name,
          email: customer.user.email 
        },
        ipAddress: clientIp,
        riskLevel: 'CRITICAL',
      })

      await logActivity({
        adminId: session.id,
        adminEmail: session.email,
        adminName: session.name,
        branchId: session.branchId,
        action: 'DELETE',
        entityType: 'CUSTOMER' as any,
        entityId: id,
        description: `Hard deleted customer ${customer.user.name}`,
        details: { hardDelete: true } as any
      })

      return NextResponse.json({ 
        message: 'Customer permanently deleted',
        customerId: id 
      })
    } else {
      await prisma.customerProfile.update({
        where: { id },
        data: { status: 'INACTIVE' }
      })

      await prisma.user.update({
        where: { id: customer.userId },
        data: { isActive: false }
      })

      await prisma.customerActivity.create({
        data: {
          customerId: id,
          type: 'STATUS_CHANGED',
          title: 'Customer Deactivated',
          description: `Customer deactivated by ${session.email}`,
          createdById: session.id,
          createdByName: session.name || null,
          createdByEmail: session.email,
          ipAddress: clientIp,
        }
      })

      await createAuditLog({
        action: 'DELETE',
        category: 'CUSTOMER',
        userId: session.id,
        userEmail: session.email,
        userRole: session.role,
        userProvince: session.province || undefined,
        entityType: 'CustomerProfile',
        entityId: id,
        entityName: customer.user.name,
        description: `Soft deleted (deactivated) customer profile for ${customer.user.name}`,
        oldValue: { status: 'ACTIVE' },
        newValue: { status: 'INACTIVE' },
        ipAddress: clientIp,
        riskLevel: 'HIGH',
      })

      await logActivity({
        adminId: session.id,
        adminEmail: session.email,
        adminName: session.name,
        branchId: session.branchId,
        action: 'DELETE',
        entityType: 'CUSTOMER' as any,
        entityId: id,
        description: `Soft deleted customer ${customer.user.name}`,
        details: { hardDelete: false } as any
      })

      return NextResponse.json({ 
        message: 'Customer deactivated successfully',
        customerId: id 
      })
    }
  } catch (error) {
    console.error('Error deleting customer:', error)
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 })
  }
}
