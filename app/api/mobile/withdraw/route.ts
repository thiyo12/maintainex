import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { requestPayout } from '@/lib/payout-engine'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount required' }, { status: 400 })
    }

    const method = typeof body.method === 'string' && ['bank', 'wallet'].includes(body.method)
      ? body.method
      : 'bank'
    const bankDetails = body.bankDetails ? JSON.stringify(body.bankDetails) : null
    const idempotencyKey = request.headers.get('idempotency-key') ||
      (typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '')

    if (!idempotencyKey) {
      return NextResponse.json({ error: 'Idempotency-Key header is required' }, { status: 400 })
    }

    const amountCents = BigInt(Math.round(amount * 100))
    const result = await requestPayout(
      user.id,
      amountCents,
      method,
      bankDetails,
      idempotencyKey,
      user.id
    )

    if (!result.ok) {
      const status = result.code === 'INSUFFICIENT_FUNDS' ? 400
        : result.code === 'BELOW_MINIMUM' ? 400
        : result.code === 'WALLET_FROZEN' ? 403
        : result.code === 'IDEMPOTENCY_CONFLICT' ? 409
        : result.code === 'WALLET_NOT_FOUND' || result.code === 'BALANCE_NOT_FOUND' ? 409
        : 400
      return NextResponse.json({ error: result.error, code: result.code }, { status })
    }

    const payout = await prisma.payout.findUnique({ where: { id: result.payoutId } })
    if (!payout) return NextResponse.json({ error: 'Payout not found after reservation' }, { status: 500 })

    return NextResponse.json({
      id: payout.id,
      amount: payout.amount.toString(),
      currency: 'LKR',
      status: payout.status,
      createdAt: payout.createdAt.toISOString(),
    }, { status: 201 })
  } catch (error) {
    console.error('Withdraw error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
