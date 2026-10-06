import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { readCanonicalProviderBalance, readCanonicalCustomerBalance } from '@/lib/financial-read'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') || 'customer'

    if (role === 'provider') {
      const canonical = await readCanonicalProviderBalance(user.id)
      const transactions = canonical
        ? await prisma.walletTransaction.findMany({
            where: { userId: user.id, walletType: 'PROVIDER' },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
        : []
      return NextResponse.json({
        wallet: canonical
          ? {
              availableBalance: String(canonical.availableBalance),
              pendingBalance: String(canonical.pendingBalance),
              balance: String(canonical.balance),
              version: canonical.version,
            }
          : { availableBalance: '0', pendingBalance: '0', balance: '0', version: 0 },
        transactions: transactions.map(t => ({
          ...t,
          amount: String(t.amount),
          balanceBefore: String(t.balanceBefore),
          balanceAfter: String(t.balanceAfter),
        })),
      })
    }

    const canonical = await readCanonicalCustomerBalance(user.id)
    const transactions = canonical
      ? await prisma.walletTransaction.findMany({
          where: { userId: user.id, walletType: 'CUSTOMER' },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : []
    return NextResponse.json({
      wallet: canonical
        ? {
            balance: String(canonical.balance),
            availableBalance: String(canonical.availableBalance),
            pendingBalance: String(canonical.pendingBalance),
            version: canonical.version,
          }
        : { balance: '0', availableBalance: '0', pendingBalance: '0', version: 0 },
      transactions: transactions.map(t => ({
        ...t,
        amount: String(t.amount),
        balanceBefore: String(t.balanceBefore),
        balanceAfter: String(t.balanceAfter),
      })),
    })
  } catch (error) {
    secureConsole.error('Wallet error:', error)
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

    if (action === 'WITHDRAW') {
      return NextResponse.json({
        error: 'Customer wallet withdrawals are temporarily unavailable',
        code: 'CUSTOMER_WITHDRAW_UNAVAILABLE',
      }, { status: 503 })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    secureConsole.error('Wallet transaction error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
