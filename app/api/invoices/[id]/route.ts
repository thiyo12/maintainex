import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: (await params).id },
      include: { 
        branch: true, 
        items: true 
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const isSuper = session.role === 'SUPER_ADMIN'
    if (!isSuper && session.branchId !== invoice.branchId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Invoice fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 })
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
    const { items, ...updateData } = body

    const invoice = await prisma.invoice.update({
      where: { id: (await params).id },
      data: updateData,
      include: { items: true }
    })

    if (items && items.length > 0) {
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } })
      await prisma.invoiceItem.createMany({
        data: items.map((item: any) => ({
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice
        }))
      })
    }

    const updated = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { items: true }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Invoice update error:', error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
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

    await prisma.invoice.update({
      where: { id: (await params).id },
      data: { isDeleted: true }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Invoice delete error:', error)
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
  }
}