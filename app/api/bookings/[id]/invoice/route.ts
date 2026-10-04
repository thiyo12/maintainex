import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { guardCrmRequest } from '@/lib/crm/security'
import { resolveReportBranchScope } from '@/lib/reports/branch-scope'
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
    const guard = await guardCrmRequest(request, {
      permission: 'commission:manage',
      permissionClass: 'SENSITIVE',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response

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
    if (!booking.branchId) {
      return NextResponse.json({ error: 'Booking branch is required' }, { status: 409 })
    }
    const scope = await resolveReportBranchScope(guard.context, booking.branchId)
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status })
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
        createdBy: guard.context.adminId,
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
    secureConsole.error('Create invoice from booking error:', error)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}