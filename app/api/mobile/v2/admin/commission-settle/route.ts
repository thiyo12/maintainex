import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || !['SUPER_ADMIN', 'OPERATIONS', 'FINANCE'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: any = {}
    if (status) where.status = status

    const settlements = await prisma.commissionSettlement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ settlements: settlements.map((s) => ({ ...s, jobAmount: Number(s.jobAmount), commissionAmount: Number(s.commissionAmount) })) })
  } catch (error) {
    console.error('List commission settlements error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || !['SUPER_ADMIN', 'OPERATIONS', 'FINANCE'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { settlementId } = body

    if (!settlementId) {
      return NextResponse.json({ error: 'settlementId required' }, { status: 400 })
    }

    const settlement = await prisma.commissionSettlement.findUnique({
      where: { id: settlementId },
    })

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 })
    }

    if (settlement.status !== 'PENDING') {
      return NextResponse.json({ error: 'Settlement already processed' }, { status: 400 })
    }

    const updated = await prisma.commissionSettlement.update({
      where: { id: settlementId },
      data: {
        status: 'SETTLED',
        settledAt: new Date(),
      },
    })

    await prisma.walletTransaction.create({
      data: {
        userId: settlement.providerId,
        walletType: 'PROVIDER',
        type: 'DEBIT',
        amount: Number(settlement.commissionAmount),
        balanceBefore: 0,
        balanceAfter: 0,
        reference: `Commission settlement for job ${settlement.jobId}`,
        referenceType: 'COMMISSION',
        referenceId: settlement.id,
      },
    })

    return NextResponse.json({ settlement: { ...updated, jobAmount: Number(updated.jobAmount), commissionAmount: Number(updated.commissionAmount) } })
  } catch (error) {
    console.error('Settle commission error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
