import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, isSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-log'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        service: {
          include: { category: true }
        }
      }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (!isSuperAdmin(session) && booking.branchId !== user.branchId) {
      return NextResponse.json({ error: 'Unauthorized - This booking belongs to another branch' }, { status: 403 })
    }

    return NextResponse.json(booking)
  } catch (error) {
    console.error('Error fetching booking:', error)
    return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const existingBooking = await prisma.booking.findUnique({
      where: { id: params.id }
    })

    if (!existingBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (!isSuperAdmin(session) && existingBooking.branchId !== user.branchId) {
      return NextResponse.json({ error: 'Unauthorized - This booking belongs to another branch' }, { status: 403 })
    }

    const body = await request.json()
    const { status } = body

    if (status && !['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const booking = await prisma.booking.update({
      where: { id: params.id },
      data: { status },
      include: { service: true }
    })

    await logActivity({
      adminId: (session.user as any).id,
      adminEmail: session.user!.email!,
      adminName: session.user!.name,
      branchId: user.branchId,
      action: 'STATUS_CHANGE',
      entityType: 'BOOKING',
      entityId: booking.id,
      description: `Updated booking status to ${status}`,
      details: { previousStatus: existingBooking.status, newStatus: status, customerName: booking.name }
    })

    return NextResponse.json(booking)
  } catch (error) {
    console.error('Error updating booking:', error)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: { service: true }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (!isSuperAdmin(session) && booking.branchId !== user.branchId) {
      return NextResponse.json({ error: 'Unauthorized - This booking belongs to another branch' }, { status: 403 })
    }

    await prisma.booking.delete({
      where: { id: params.id }
    })

    await logActivity({
      adminId: (session.user as any).id,
      adminEmail: session.user!.email!,
      adminName: session.user!.name,
      branchId: user.branchId,
      action: 'DELETE',
      entityType: 'BOOKING',
      entityId: params.id,
      description: `Deleted booking for ${booking?.name}`,
      details: { customerName: booking?.name, service: booking?.service?.title }
    })

    return NextResponse.json({ message: 'Booking deleted successfully' })
  } catch (error) {
    console.error('Error deleting booking:', error)
    return NextResponse.json({ error: 'Failed to delete booking' }, { status: 500 })
  }
}
