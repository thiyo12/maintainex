import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { amount, method, bankDetails } = await request.json()
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount required' }, { status: 400 })
    }

    const payout = await prisma.payout.create({
      data: {
        userId: user.id,
        amount: Math.round(amount * 100),
        description: 'Withdrawal request',
        status: 'PENDING',
        source: 'WITHDRAWAL',
        method: method && ['bank', 'wallet'].includes(method) ? method : 'bank',
        bankDetails: bankDetails ? String(bankDetails) : null,
      },
    })

    return NextResponse.json({
      id: payout.id,
      amount: Number(payout.amount),
      status: payout.status,
      createdAt: payout.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('Withdraw error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
