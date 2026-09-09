import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { postLedgerTransaction } from '@/lib/ledger'
import { readCanonicalProviderBalance } from '@/lib/financial-read'
import { bigIntToSafeNumber } from '@/lib/money'
import { refundEscrow } from '@/lib/domain/job-lifecycle'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || !['SUPER_ADMIN', 'MANAGER', 'FINANCE'].includes(user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

    return NextResponse.json({ escrows: escrows.map((e) => ({ ...e, amount: bigIntToSafeNumber(e.amount), serviceFee: bigIntToSafeNumber(e.serviceFee), totalAmount: bigIntToSafeNumber(e.totalAmount) })), total, page, limit })
  } catch (error) {
    console.error('Admin escrows error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || !['SUPER_ADMIN', 'MANAGER', 'FINANCE'].includes(user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
      const canonicalProviderBalance = await readCanonicalProviderBalance(escrow.providerId)
      const currentProviderBalance = canonicalProviderBalance ? bigIntToSafeNumber(canonicalProviderBalance.availableBalance) : (providerWallet?.availableBalance || 0)

      await prisma.$transaction(async (tx) => {
        await tx.jobEscrow.update({
          where: { id: escrow.id },
          data: { status: 'RELEASED', releasedAt: new Date() },
        })
        await tx.providerWallet.upsert({
          where: { userId: escrow.providerId },
          create: { userId: escrow.providerId, availableBalance: bigIntToSafeNumber(escrow.amount) },
          update: { availableBalance: { increment: bigIntToSafeNumber(escrow.amount) } },
        })
        await tx.walletTransaction.create({
          data: {
            userId: escrow.providerId,
            walletType: 'PROVIDER',
            type: 'CREDIT',
            amount: bigIntToSafeNumber(escrow.amount),
            balanceBefore: currentProviderBalance,
            balanceAfter: currentProviderBalance + bigIntToSafeNumber(escrow.amount),
            reference: 'Admin force-release escrow',
            referenceType: 'ESCROW_RELEASE',
            referenceId: escrow.id,
          },
        })
        await tx.marketplaceJob.update({
          where: { id: escrow.jobId },
          data: { status: 'COMPLETED' },
        })

        await postLedgerTransaction({
          entries: [
            { accountId: `escrow:${escrow.id}`, accountType: 'ESCROW', entryType: 'DEBIT', amount: escrow.amount },
            { accountId: `provider:${escrow.providerId}`, accountType: 'PROVIDER_WALLET', entryType: 'CREDIT', amount: escrow.amount },
          ],
          referenceType: 'ESCROW_RELEASE',
          referenceId: escrow.id,
          idempotencyKey: `admin-escrow-release:${escrow.id}`,
          description: 'Admin force-release escrow',
          createdBy: user.id,
        }, tx)
      })

      return NextResponse.json({ success: true, message: 'Escrow released by admin' })
    }

    if (action === 'REFUND') {
      if (escrow.status !== 'ON_HOLD') {
        return NextResponse.json({ error: 'Escrow must be ON_HOLD to refund' }, { status: 400 })
      }

      const result = await refundEscrow(
        { jobId: escrow.jobId, actorId: user.id, actorType: 'STAFF' },
        escrow.jobId
      )

      return NextResponse.json({ success: true, message: 'Escrow refunded by admin', refundAmount: result.refundAmount })
    }

    return NextResponse.json({ error: 'Action must be RELEASE or REFUND' }, { status: 400 })
  } catch (error) {
    console.error('Admin escrow action error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 })
  }
}
