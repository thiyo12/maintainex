import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') || 'customer'

    if (role === 'provider') {
      const wallet = await prisma.providerWallet.findUnique({ where: { userId: user.id } })
      const transactions = wallet
        ? await prisma.walletTransaction.findMany({
            where: { userId: user.id, walletType: 'PROVIDER' },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
        : []
      return NextResponse.json({
        wallet: wallet || { availableBalance: 0, pendingBalance: 0 },
        transactions,
      })
    }

    const wallet = await prisma.customerWallet.findUnique({ where: { userId: user.id } })
    const transactions = wallet
      ? await prisma.walletTransaction.findMany({
          where: { userId: user.id, walletType: 'CUSTOMER' },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : []
    return NextResponse.json({
      wallet: wallet || { balance: 0 },
      transactions,
    })
  } catch (error) {
    console.error('Wallet error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { action } = body
    if (!['TOP_UP', 'WITHDRAW'].includes(action)) {
      return NextResponse.json({ error: 'action must be TOP_UP or WITHDRAW' }, { status: 400 })
    }

    if (action === 'TOP_UP') {
      return NextResponse.json({ error: 'Payment gateway not yet integrated. Top-up coming soon.' }, { status: 501 })
    }

    // This endpoint represents the legacy CUSTOMER wallet. Customer-wallet
    // cash-out has no canonical payout model yet, so fail closed instead of
    // mutating the Float balance directly. Provider withdrawals use the
    // canonical payout engine at POST /api/mobile/withdraw.
    if (action === 'WITHDRAW') {
      return NextResponse.json({
        error: 'Customer wallet withdrawals are temporarily unavailable',
        code: 'CUSTOMER_WITHDRAW_UNAVAILABLE',
      }, { status: 503 })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Wallet transaction error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
