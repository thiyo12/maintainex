import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

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

    const body = await request.json()
    const { amount, action } = body
    if (!amount || amount <= 0) return NextResponse.json({ error: 'Valid amount required' }, { status: 400 })
    if (!['TOP_UP', 'WITHDRAW'].includes(action)) {
      return NextResponse.json({ error: 'action must be TOP_UP or WITHDRAW' }, { status: 400 })
    }

    if (action === 'TOP_UP') {
      return NextResponse.json({ error: 'Payment gateway not yet integrated. Top-up coming soon.' }, { status: 501 })
    }

    if (action === 'WITHDRAW') {
      const wallet = await prisma.customerWallet.findUnique({ where: { userId: user.id } })
      if (!wallet || wallet.balance < amount) {
        return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
      }
      if (amount < 100) {
        return NextResponse.json({ error: 'Minimum withdrawal is LKR 100' }, { status: 400 })
      }
      const newBalance = wallet.balance - amount

      await prisma.$transaction([
        prisma.customerWallet.update({
          where: { userId: user.id },
          data: { balance: newBalance },
        }),
        prisma.walletTransaction.create({
          data: {
            userId: user.id,
            walletType: 'CUSTOMER',
            type: 'DEBIT',
            amount,
            balanceBefore: wallet.balance,
            balanceAfter: newBalance,
            reference: 'Wallet withdrawal',
            referenceType: 'WITHDRAWAL',
            referenceId: '',
          },
        }),
      ])
      return NextResponse.json({ success: true, balance: newBalance })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Wallet transaction error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
