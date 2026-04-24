import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

function generateInvoiceNumber(): string {
  const year = new Date().getFullYear()
  return `INV-${year}-${Date.now().toString().slice(-4)}`
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

    const quotation = await prisma.quotation.findUnique({
      where: { id: (await params).id },
      include: { 
        branch: true, 
        items: true 
      }
    })

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    const isSuper = session.role === 'SUPER_ADMIN'
    if (!isSuper && session.branchId !== quotation.branchId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json(quotation)
  } catch (error) {
    console.error('Quotation fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch quotation' }, { status: 500 })
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

    if (!session.canEditServices && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const { items, convertToInvoice, ...updateData } = body

    const quotation = await prisma.quotation.update({
      where: { id: (await params).id },
      data: updateData,
      include: { items: true }
    })

    if (items && items.length > 0) {
      await prisma.quotationItem.deleteMany({ where: { quotationId: quotation.id } })
      await prisma.quotationItem.createMany({
        data: items.map((item: any) => ({
          quotationId: quotation.id,
          description: item.description,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice
        }))
      })
    }

    if (convertToInvoice) {
      const invoiceNumber = generateInvoiceNumber()
      const existingItems = await prisma.quotationItem.findMany({
        where: { quotationId: quotation.id }
      })

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          branchId: quotation.branchId,
          customerName: quotation.customerName,
          customerEmail: quotation.customerEmail,
          customerPhone: quotation.customerPhone,
          customerAddress: quotation.customerAddress,
          subtotal: quotation.subtotal,
          tax: quotation.tax,
          total: quotation.total,
          notes: `Converted from Quotation ${quotation.quotationNumber}`,
          createdBy: session.id,
          items: {
            create: existingItems.map(item => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice
            }))
          }
        },
        include: { items: true }
      })

      await prisma.quotation.update({
        where: { id: quotation.id },
        data: { status: 'ACCEPTED' }
      })

      return NextResponse.json({ invoice, converted: true })
    }

    const updated = await prisma.quotation.findUnique({
      where: { id: quotation.id },
      include: { items: true }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Quotation update error:', error)
    return NextResponse.json({ error: 'Failed to update quotation' }, { status: 500 })
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

    if (!session.canEditServices && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    await prisma.quotation.update({
      where: { id: (await params).id },
      data: { isDeleted: true }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Quotation delete error:', error)
    return NextResponse.json({ error: 'Failed to delete quotation' }, { status: 500 })
  }
}