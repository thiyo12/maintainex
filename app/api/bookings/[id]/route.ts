import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/authentication/auth-utils'
import { guardCrmRequest } from '@/lib/crm/security'
import { resolveReportBranchScope } from '@/lib/reports/branch-scope'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-log'

async function loadBooking(id: string) {
  return prisma.booking.findUnique({ where: { id } })
}

async function authorizeCrmBooking(
  request: NextRequest,
  id: string,
  permission: 'jobs:view' | 'jobs:manage',
  level: 'read' | 'mutation' | 'sensitive',
) {
  const guard = await guardCrmRequest(request, {
    permission,
    level,
    requireCountryScope: true,
  })
  if (!guard.ok) return { ok: false as const, response: guard.response }

  const booking = await loadBooking(id)
  if (!booking) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Booking not found' }, { status: 404 }),
    }
  }

  if (!guard.context.isSuperAdmin) {
    if (!booking.branchId) {
      return {
        ok: false as const,
        response: NextResponse.json(
          { error: 'Booking is outside your assigned countries' },
          { status: 403 },
        ),
      }
    }
    const scope = await resolveReportBranchScope(guard.context, booking.branchId)
    if (!scope.ok) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: scope.error }, { status: scope.status }),
      }
    }
  }

  return { ok: true as const, guard: guard.context, booking }
}

async function withBookingRelations(booking: any) {
  const [service, user] = await Promise.all([
    booking.serviceId
      ? prisma.service.findUnique({
          where: { id: booking.serviceId },
          include: { category: true },
        })
      : null,
    booking.userId
      ? prisma.user.findUnique({
          where: { id: booking.userId },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        })
      : null,
  ])

  return { ...booking, service, user }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // Preserve the legacy customer read path, but only for an authenticated
    // CUSTOMER reading their own booking. Staff/admin access must go through
    // the live CRM security boundary below.
    const legacySession = await getSession(request)
    if (legacySession?.role === 'CUSTOMER') {
      const booking = await loadBooking(id)
      if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
      }
      if (!booking.userId || booking.userId !== legacySession.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json(await withBookingRelations(booking))
    }

    const access = await authorizeCrmBooking(request, id, 'jobs:view', 'read')
    if (!access.ok) return access.response
    return NextResponse.json(await withBookingRelations(access.booking))
  } catch (error) {
    console.error('Error fetching booking:', error)
    return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const access = await authorizeCrmBooking(request, id, 'jobs:manage', 'mutation')
    if (!access.ok) return access.response

    const body = await request.json()
    const status = body?.status
    if (
      typeof status !== 'string' ||
      !['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)
    ) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const booking = await prisma.$transaction(async tx => {
      const claimed = await tx.booking.updateMany({
        where: { id, status: access.booking.status },
        data: { status },
      })
      if (claimed.count !== 1) throw new Error('BOOKING_STATE_CHANGED')

      const updated = await tx.booking.findUnique({ where: { id } })
      if (!updated) throw new Error('BOOKING_NOT_FOUND')

      if (status === 'COMPLETED' && access.booking.status !== 'COMPLETED') {
        if (!updated.branchId) throw new Error('BOOKING_BRANCH_REQUIRED')

        const service = updated.serviceId
          ? await tx.service.findUnique({ where: { id: updated.serviceId } })
          : null

        const invoiceNumber =
          `INV-${new Date().getFullYear()}-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`

        await tx.invoice.create({
          data: {
            invoiceNumber,
            branchId: updated.branchId,
            customerName: updated.name || 'Unknown Customer',
            customerEmail: updated.email,
            customerPhone: updated.phone,
            customerAddress: updated.address,
            subtotal: updated.totalPrice || 0,
            tax: 0,
            total: updated.totalPrice || 0,
            status: 'DRAFT',
            paymentStatus: 'UNPAID',
            notes: `Booking Reference: ${updated.id.slice(-8).toUpperCase()}${service ? ` - ${service.name}` : ''}`,
            createdBy: access.guard.adminId,
            items: service
              ? {
                  create: [
                    {
                      description: service.name,
                      quantity: 1,
                      unitPrice: updated.totalPrice || 0,
                      totalPrice: updated.totalPrice || 0,
                    },
                  ],
                }
              : undefined,
          },
        })
      }

      return updated
    })

    await logActivity({
      adminId: access.guard.adminId,
      adminEmail: access.guard.email,
      adminName: access.guard.email,
      branchId: booking.branchId,
      action: 'STATUS_CHANGE',
      entityType: 'BOOKING',
      entityId: booking.id,
      description: `Updated booking status to ${status}`,
      details: {
        previousStatus: access.booking.status,
        newStatus: status,
        customerName: booking.name,
      },
    })

    return NextResponse.json(await withBookingRelations(booking))
  } catch (error) {
    if (error instanceof Error && error.message === 'BOOKING_STATE_CHANGED') {
      return NextResponse.json(
        { error: 'Booking state changed. Refresh and try again.' },
        { status: 409 },
      )
    }
    console.error('Error updating booking:', error)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const access = await authorizeCrmBooking(request, id, 'jobs:manage', 'sensitive')
    if (!access.ok) return access.response

    await prisma.booking.delete({ where: { id } })

    await logActivity({
      adminId: access.guard.adminId,
      adminEmail: access.guard.email,
      adminName: access.guard.email,
      branchId: access.booking.branchId,
      action: 'DELETE',
      entityType: 'BOOKING',
      entityId: access.booking.id,
      description: 'Deleted booking',
      details: { customerName: access.booking.name },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting booking:', error)
    return NextResponse.json({ error: 'Failed to delete booking' }, { status: 500 })
  }
}
