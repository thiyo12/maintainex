import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {}
    if (status) where.status = status

    const [escrows, total] = await Promise.all([
      prisma.jobEscrow.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.jobEscrow.count({ where }),
    ])

    return NextResponse.json({ escrows, total, page, limit })
  } catch (error) {
    console.error('Admin escrows error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { escrowId, action } = body

    if (!escrowId || !action) {
      return NextResponse.json({ error: 'escrowId and action required' }, { status: 400 })
    }

    const escrow = await prisma.jobEscrow.findUnique({ where: { id: escrowId } })
    if (!escrow) return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })

    if (action === 'RELEASE') {
      if (escrow.status !== 'ON_HOLD') {
        return NextResponse.json({ error: 'Escrow must be ON_HOLD to force-release' }, { status: 400 })
      }

      const providerWallet = await prisma.providerWallet.findUnique({
        where: { userId: escrow.providerId },
      })

      await prisma.$transaction([
        prisma.jobEscrow.update({
          where: { id: escrow.id },
          data: { status: 'RELEASED', releasedAt: new Date() },
        }),
        prisma.providerWallet.upsert({
          where: { userId: escrow.providerId },
          create: { userId: escrow.providerId, availableBalance: escrow.amount },
          update: { availableBalance: { increment: escrow.amount } },
        }),
        prisma.walletTransaction.create({
          data: {
            userId: escrow.providerId,
            walletType: 'PROVIDER',
            type: 'CREDIT',
            amount: escrow.amount,
            balanceBefore: providerWallet?.availableBalance || 0,
            balanceAfter: (providerWallet?.availableBalance || 0) + escrow.amount,
            reference: 'Admin force-release escrow',
            referenceType: 'ESCROW_RELEASE',
            referenceId: escrow.id,
          },
        }),
        prisma.marketplaceJob.update({
          where: { id: escrow.jobId },
          data: { status: 'COMPLETED' },
        }),
      ])

      return NextResponse.json({ success: true, message: 'Escrow released by admin' })
    }

    if (action === 'REFUND') {
      if (escrow.status !== 'ON_HOLD') {
        return NextResponse.json({ error: 'Escrow must be ON_HOLD to refund' }, { status: 400 })
      }

      const customerWallet = await prisma.customerWallet.findUnique({
        where: { userId: escrow.customerId },
      })
      const balanceBefore = customerWallet?.balance || 0

      await prisma.$transaction([
        prisma.jobEscrow.update({
          where: { id: escrow.id },
          data: { status: 'REFUNDED', refundedAt: new Date() },
        }),
        prisma.customerWallet.update({
          where: { userId: escrow.customerId },
          data: { balance: balanceBefore + escrow.totalAmount },
        }),
        prisma.walletTransaction.create({
          data: {
            userId: escrow.customerId,
            walletType: 'CUSTOMER',
            type: 'CREDIT',
            amount: escrow.totalAmount,
            balanceBefore,
            balanceAfter: balanceBefore + escrow.totalAmount,
            reference: 'Admin force-refund escrow',
            referenceType: 'ESCROW_REFUND',
            referenceId: escrow.id,
          },
        }),
        prisma.marketplaceJob.update({
          where: { id: escrow.jobId },
          data: { status: 'CANCELLED' },
        }),
      ])

      return NextResponse.json({ success: true, message: 'Escrow refunded by admin' })
    }

    return NextResponse.json({ error: 'Action must be RELEASE or REFUND' }, { status: 400 })
  } catch (error) {
    console.error('Admin escrow action error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
