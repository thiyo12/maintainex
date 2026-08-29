import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'FINANCE']

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'providers'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    let providerWallets: any[] = []
    let customerWallets: any[] = []
    let transactions: any[] = []

    if (type === 'providers') {
      const wallets = await prisma.providerWallet.findMany({
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit
      })

      const userIds = wallets.map(w => w.userId)
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, mxId: true }
      })
      const userMap = new Map(users.map(u => [u.id, u]))

      providerWallets = wallets.map(w => ({
        ...w,
        user: userMap.get(w.userId) || null
      }))
    } else if (type === 'customers') {
      const wallets = await prisma.customerWallet.findMany({
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit
      })

      const userIds = wallets.map(w => w.userId)
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true }
      })
      const userMap = new Map(users.map(u => [u.id, u]))

      customerWallets = wallets.map(w => ({
        ...w,
        user: userMap.get(w.userId) || null
      }))
    } else if (type === 'transactions') {
      const txns = await prisma.walletTransaction.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      })

      const userIds = [...new Set(txns.map(t => t.userId))]
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true }
      })
      const userMap = new Map(users.map(u => [u.id, u]))

      transactions = txns.map(t => ({
        ...t,
        user: userMap.get(t.userId) || null
      }))
    }

    return NextResponse.json({
      providerWallets,
      customerWallets,
      transactions
    })
  } catch (error) {
    console.error('Wallets GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch wallet data' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const { walletId, action } = body

    if (!walletId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (action === 'FREEZE' || action === 'UNFREEZE') {
      const isFrozen = action === 'FREEZE'

      const providerWallet = await prisma.providerWallet.findUnique({
        where: { id: walletId }
      })

      if (providerWallet) {
        const updated = await prisma.providerWallet.update({
          where: { id: walletId },
          data: { isFrozen }
        })
        return NextResponse.json({ wallet: updated })
      }

      const customerWallet = await prisma.customerWallet.findUnique({
        where: { id: walletId }
      })

      if (customerWallet) {
        const updated = await prisma.customerWallet.update({
          where: { id: walletId },
          data: { isFrozen }
        })
        return NextResponse.json({ wallet: updated })
      }

      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Wallets PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update wallet' }, { status: 500 })
  }
}
