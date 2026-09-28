import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { requestPayout } from '@/lib/payout-engine'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'
import { auditPayoutRequest } from '@/lib/financial-audit'
import type { Currency } from '@/lib/shared/money/money'

function parseMajorAmountToMinor(value: unknown): bigint | null {
  let raw: string
  if (typeof value === 'string') {
    raw = value.trim()
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    raw = value.toString()
  } else {
    return null
  }

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

    const rateLimitResponse = await requireFinancialRateLimit(request, 'withdraw')
    if (rateLimitResponse) return rateLimitResponse

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

    const wallet = await prisma.providerWallet.findUnique({ where: { userId: user.id } })
    if (!wallet) {
      return NextResponse.json({ error: 'Provider wallet not found', code: 'WALLET_NOT_FOUND' }, { status: 404 })
    }

    const requestedCurrency: Currency = typeof body.currency === 'string' && body.currency === 'CAD'
      ? 'CAD'
      : 'LKR'

    if (requestedCurrency === 'CAD') {
      return NextResponse.json({
        error: 'CAD withdrawals are not yet supported',
        code: 'CAD_WITHDRAWAL_NOT_SUPPORTED',
      }, { status: 400 })
    }

    const canonicalBalance = await prisma.walletBalance.findFirst({
      where: { walletId: wallet.id, walletType: 'PROVIDER', currency: 'LKR' },
    })
    if (!canonicalBalance) {
      return NextResponse.json({
        error: 'No canonical LKR balance found',
        code: 'LKR_BALANCE_NOT_FOUND',
      }, { status: 400 })
    }

    const result = await requestPayout(
      user.id,
      amountCents,
      method,
      bankDetails,
      idempotencyKey,
      user.id,
      'LKR',
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

    auditPayoutRequest({
      payoutId: payout.id,
      actorId: user.id,
      amount: payout.amount,
      currency: payout.currency,
      method,
    })

    return NextResponse.json({
      id: payout.id,
      amount: payout.amount.toString(),
      currency: payout.currency,
      status: payout.status,
      createdAt: payout.createdAt.toISOString(),
    }, { status: 201 })
  } catch (error) {
    console.error('Withdraw error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
