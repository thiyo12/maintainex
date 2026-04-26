import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-log'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id: (await params).id }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (session.role !== 'SUPER_ADMIN' && booking.branchId && booking.branchId !== session.branchId) {
      return NextResponse.json({ error: 'Unauthorized - This booking belongs to another branch' }, { status: 403 })
    }

    let serviceWithCategory = null
    if (booking.serviceId) {
      serviceWithCategory = await prisma.service.findUnique({
        where: { id: booking.serviceId },
        include: { category: true }
      })
    }
    
    let user = null
    if (booking.userId) {
      user = await prisma.user.findUnique({
        where: { id: booking.userId }
      })
    }

    return NextResponse.json({ ...booking, service: serviceWithCategory, user })
  } catch (error) {
    console.error('Error fetching booking:', error)
    return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existingBooking = await prisma.booking.findUnique({
      where: { id: (await params).id }
    })

    if (!existingBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (session.role !== 'SUPER_ADMIN' && existingBooking.branchId !== session.branchId) {
      return NextResponse.json({ error: 'Unauthorized - This booking belongs to another branch' }, { status: 403 })
    }

    const body = await request.json()
    const { status } = body

    if (status && !['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const booking = await prisma.booking.update({
      where: { id: (await params).id },
      data: { status }
    })

    // Auto-create invoice when booking is completed
    if (status === 'COMPLETED' && existingBooking.status !== 'COMPLETED') {
      try {
        const service = booking.serviceId 
          ? await prisma.service.findUnique({ where: { id: booking.serviceId } })
          : null

        const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`
        const invoiceBranchId = booking.branchId || session.branchId || ''
        
        const invoice = await prisma.invoice.create({
          data: {
            invoiceNumber,
            branchId: invoiceBranchId,
            customerName: booking.name || 'Unknown Customer',
            customerEmail: booking.email,
            customerPhone: booking.phone,
            customerAddress: booking.address,
            subtotal: booking.totalPrice || 0,
            tax: 0,
            total: booking.totalPrice || 0,
            status: 'DRAFT',
            paymentStatus: 'UNPAID',
            notes: `Booking Reference: ${booking.id.slice(-8).toUpperCase()}${service ? ` - ${service.name}` : ''}`,
            createdBy: session.id,
            items: service ? {
              create: [{
                description: service.name,
                quantity: 1,
                unitPrice: booking.totalPrice || 0,
                totalPrice: booking.totalPrice || 0
              }]
            } : undefined
          },
          include: { items: true }
        })
        
        console.log('Auto-created invoice:', invoice.id, 'for booking:', booking.id)
      } catch (invErr) {
        console.error('Failed to auto-create invoice:', invErr)
        // Don't fail the booking update if invoice creation fails
      }
    }

    let service = null
    if (booking.serviceId) {
      service = await prisma.service.findUnique({
        where: { id: booking.serviceId }
      })
    }
    
    let user = null
    if (booking.userId) {
      user = await prisma.user.findUnique({
        where: { id: booking.userId }
      })
    }

    await logActivity({
      adminId: session.id,
      adminEmail: session.email,
      adminName: session.name,
      branchId: session.branchId,
      action: 'STATUS_CHANGE',
      entityType: 'BOOKING',
      entityId: booking.id,
      description: `Updated booking status to ${status}`,
      details: { previousStatus: existingBooking.status, newStatus: status, customerName: booking.name }
    })

    return NextResponse.json({ ...booking, service, user })
  } catch (error) {
    console.error('Error updating booking:', error)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
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

    const booking = await prisma.booking.findUnique({
      where: { id: (await params).id }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (session.role !== 'SUPER_ADMIN' && booking.branchId && booking.branchId !== session.branchId) {
      return NextResponse.json({ error: 'Unauthorized - This booking belongs to another branch' }, { status: 403 })
    }

    await prisma.booking.delete({
      where: { id: (await params).id }
    })

    await logActivity({
      adminId: session.id,
      adminEmail: session.email,
      adminName: session.name,
      branchId: session.branchId,
      action: 'DELETE',
      entityType: 'BOOKING',
      entityId: booking.id,
      description: `Deleted booking`,
      details: { customerName: booking.name }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting booking:', error)
    return NextResponse.json({ error: 'Failed to delete booking' }, { status: 500 })
  }
}