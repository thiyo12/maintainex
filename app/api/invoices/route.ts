import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

function generateInvoiceNumber(): string {
  const year = new Date().getFullYear()
  return `INV-${year}-${Date.now().toString().slice(-4)}`
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isSuper = session.role === 'SUPER_ADMIN'
    const userBranchId = session.branchId

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const paymentStatus = searchParams.get('paymentStatus')

    const where: any = { isDeleted: false }

    if (!isSuper && userBranchId) {
      where.branchId = userBranchId
    }

    if (status) where.status = status
    if (paymentStatus) where.paymentStatus = paymentStatus

    const invoices = await prisma.invoice.findMany({
      where,
      include: { branch: { select: { id: true, name: true } }, items: true },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(invoices)
  } catch (error) {
    console.error('Invoices fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.canEditServices && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const { customerName, customerEmail, customerPhone, customerAddress, subtotal, tax, total, items, dueDate, notes, branchId } = body

    if (!customerName || !branchId || !subtotal || !total) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const invoiceNumber = generateInvoiceNumber()

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        branchId,
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        subtotal,
        tax: tax || 0,
        total,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes,
        createdBy: session.id,
        items: items?.length > 0 ? {
          create: items.map((item: any) => ({
            description: item.description,
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice
          }))
        } : undefined
      },
      include: { items: true }
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error('Invoice create error:', error)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}