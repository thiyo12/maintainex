import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

function generateInvoiceNumber(): string {
  const year = new Date().getFullYear()
  return `INV-${year}-${Date.now().toString().slice(-4)}`
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

    if (!session.canEditServices && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { items, tax, dueDate, notes } = body

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { service: true, branch: true }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const invoiceNumber = generateInvoiceNumber()
    const subtotal = items?.length > 0 
      ? items.reduce((sum: number, item: any) => sum + item.totalPrice, 0)
      : booking.totalPrice

    const total = subtotal + (tax || 0)

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        branchId: booking.branchId!,
        customerName: booking.name || 'Unknown',
        customerEmail: booking.email,
        customerPhone: booking.phone,
        customerAddress: booking.address,
        subtotal,
        tax: tax || 0,
        total,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || `Created from booking on ${new Date(booking.date).toLocaleDateString()}`,
        createdBy: session.id,
        items: items?.length > 0 
          ? {
              create: items.map((item: any) => ({
                description: item.description,
                quantity: item.quantity || 1,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice
              }))
            }
          : undefined
      },
      include: { items: true }
    })

    await prisma.booking.update({
      where: { id },
      data: { status: 'INVOICED' }
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error('Create invoice from booking error:', error)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}