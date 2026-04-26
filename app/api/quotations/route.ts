import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

function generateQuotationNumber(): string {
  const year = new Date().getFullYear()
  return `QT-${year}-${Date.now().toString().slice(-4)}`
}

export async function GET(request: NextRequest) {
  try {
    console.log('=== Quotations GET called ===')
    const session = await getSession(request)
    console.log('Session:', session)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isSuper = session.role === 'SUPER_ADMIN'
    const userBranchId = session.branchId

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: any = { isDeleted: false }

    if (!isSuper && userBranchId) {
      where.branchId = userBranchId
    }

    if (status) where.status = status

    console.log('Query where:', where)

    const quotations = await prisma.quotation.findMany({
      where,
      include: { branch: { select: { id: true, name: true } }, items: true },
      orderBy: { createdAt: 'desc' }
    })

    console.log('Quotations found:', quotations.length)
    return NextResponse.json(quotations)
  } catch (error) {
    console.error('!!! Quotations fetch error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch quotations', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 })
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
    const { customerName, customerEmail, customerPhone, customerAddress, subtotal, tax, total, validUntil, items, notes, branchId } = body

    if (!customerName || !branchId || !subtotal || !total || !validUntil) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const quotationNumber = generateQuotationNumber()

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        branchId,
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        subtotal,
        tax: tax || 0,
        total,
        validUntil: new Date(validUntil),
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

    return NextResponse.json(quotation, { status: 201 })
  } catch (error) {
    console.error('Quotation create error:', error)
    return NextResponse.json({ error: 'Failed to create quotation' }, { status: 500 })
  }
}