import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { requestPayout } from '@/lib/payout-engine'

function parseMajorAmountToMinor(value: unknown): bigint | null {
  let raw: string
  if (typeof value === 'string') {
    raw = value.trim()
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    raw = value.toString()
  } else {
    return null
  }

  // LKR withdrawal API accepts major units with at most 2 decimal places.
  // Convert with string arithmetic so 0.1/0.2 floating-point behaviour can
  // never change a financial amount.
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null
  const [whole, fractional = ''] = raw.split('.')
  const cents = `${fractional}00`.slice(0, 2)
  const amountMinor = BigInt(whole) * 100n + BigInt(cents)
  return amountMinor > 0n ? amountMinor : null
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const amountCents = parseMajorAmountToMinor(body.amount)
    if (amountCents === null) {
      return NextResponse.json({ error: 'Valid amount required with at most 2 decimal places' }, { status: 400 })
    }

    const method = typeof body.method === 'string' && ['bank', 'wallet'].includes(body.method)
      ? body.method
      : 'bank'
    const bankDetails = body.bankDetails ? JSON.stringify(body.bankDetails) : null
    const idempotencyKey = request.headers.get('idempotency-key') ||
      (typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '')

    if (!idempotencyKey || idempotencyKey.length > 255) {
      return NextResponse.json({ error: 'Valid Idempotency-Key header is required' }, { status: 400 })
    }

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
