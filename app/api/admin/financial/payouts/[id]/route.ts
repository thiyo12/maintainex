import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { createAuditLog, getIp } from '@/lib/admin-rbac'
import { notifyPayoutProcessed } from '@/lib/notifications'
import { sendExpoPush } from '@/lib/push'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'FINANCE']

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payoutId = request.nextUrl.pathname.split('/').pop()
    if (!payoutId) {
      return NextResponse.json({ error: 'Missing payout id' }, { status: 400 })
    }

    const body = await request.json()
    const { action, reason, bankDetails, method } = body

    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
      include: { user: { select: { pushToken: true, name: true, email: true } } },
    })

    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 })
    }

    const amountLkr = Number(payout.amount) / 100

    if (action === 'paid') {
      if (payout.status !== 'PENDING' && payout.status !== 'PROCESSING') {
        return NextResponse.json({ error: `Payout is ${payout.status}, cannot mark as paid` }, { status: 400 })
      }

      if (payout.source === 'WITHDRAWAL') {
        const wallet = await prisma.providerWallet.findUnique({
          where: { userId: payout.userId },
        })
        const balance = wallet?.availableBalance ?? 0
        if (balance < Number(payout.amount)) {
          return NextResponse.json({ error: 'Provider wallet balance does not cover this payout' }, { status: 400 })
        }

        await prisma.$transaction([
          prisma.payout.update({
            where: { id: payout.id },
            data: {
              status: 'CLEARED',
              clearedAt: new Date(),
              processedBy: session.email,
              method: method || payout.method || 'bank',
              bankDetails: bankDetails != null ? String(bankDetails) : payout.bankDetails,
            },
          }),
          prisma.providerWallet.update({
            where: { userId: payout.userId },
            data: { availableBalance: balance - Number(payout.amount) },
          }),
          prisma.walletTransaction.create({
            data: {
              userId: payout.userId,
              walletType: 'PROVIDER',
              type: 'DEBIT',
              amount: Number(payout.amount),
              balanceBefore: balance,
              balanceAfter: balance - Number(payout.amount),
              reference: `PAYOUT_${payout.id}`,
              referenceType: 'PAYOUT',
              referenceId: payout.id,
            },
          }),
        ])
      } else {
        await prisma.payout.update({
          where: { id: payout.id },
          data: {
            status: 'CLEARED',
            clearedAt: new Date(),
            processedBy: session.email,
            method: method || payout.method || 'bank',
            bankDetails: bankDetails != null ? String(bankDetails) : payout.bankDetails,
          },
        })
      }

      await createAuditLog({
        session,
        action: 'PAYOUT_PROCESS',
        targetTable: 'Payout',
        targetId: payout.id,
        targetLabel: `${payout.user?.name || payout.user?.email} · LKR ${amountLkr}`,
        oldValue: { status: payout.status },
        newValue: { status: 'CLEARED', processedBy: session.email },
        ipAddress: getIp(request),
        userAgent: request.headers.get('user-agent'),
      })

      notifyPayoutProcessed(
        payout.userId,
        'Payout Processed',
        `Your payout of LKR ${amountLkr} has been paid out`
      )
      if (payout.user?.pushToken) {
        void sendExpoPush(
          payout.user.pushToken,
          'Payout Processed',
          `Your payout of LKR ${amountLkr} has been paid out`,
          { screen: '/(tasker)/wallet/withdraw' }
        )
      }

      return NextResponse.json({ success: true, message: `Payout of LKR ${amountLkr} marked as paid` })
    }

    if (action === 'reject') {
      if (payout.status !== 'PENDING' && payout.status !== 'PROCESSING') {
        return NextResponse.json({ error: `Payout is ${payout.status}, cannot reject` }, { status: 400 })
      }
      if (!reason || !String(reason).trim()) {
        return NextResponse.json({ error: 'A rejection reason is required' }, { status: 400 })
      }

      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: 'REJECTED',
          rejectedReason: String(reason).trim(),
          processedBy: session.email,
        },
      })

      await createAuditLog({
        session,
        action: 'PAYOUT_REJECT',
        targetTable: 'Payout',
        targetId: payout.id,
        targetLabel: `${payout.user?.name || payout.user?.email} · LKR ${amountLkr}`,
        oldValue: { status: payout.status },
        newValue: { status: 'REJECTED', reason: String(reason).trim(), processedBy: session.email },
        ipAddress: getIp(request),
        userAgent: request.headers.get('user-agent'),
      })

      notifyPayoutProcessed(
        payout.userId,
        'Payout Rejected',
        `Your payout of LKR ${amountLkr} was rejected: ${String(reason).trim()}`
      )
      if (payout.user?.pushToken) {
        void sendExpoPush(
          payout.user.pushToken,
          'Payout Rejected',
          `Your payout of LKR ${amountLkr} was rejected: ${String(reason).trim()}`,
          { screen: '/(tasker)/wallet/withdraw' }
        )
      }

      return NextResponse.json({ success: true, message: `Payout of LKR ${amountLkr} rejected` })
    }

    return NextResponse.json({ error: 'Action must be paid or reject' }, { status: 400 })
  } catch (error) {
    console.error('Payout PATCH error:', error)
    return NextResponse.json({ error: 'Failed to process payout' }, { status: 500 })
  }
}