import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, getCrmCountryFilter, guardCrmRequest } from '@/lib/crm/security'
import { auditWalletFreeze, auditWalletUnfreeze } from '@/lib/financial-audit'

async function scopedUserIds(countryFilter: ReturnType<typeof getCrmCountryFilter>) {
  if (countryFilter.id === '__NONE__') return ['__NONE__']
  return (await prisma.user.findMany({
    where: countryFilter,
    select: { id: true },
  })).map(user => user.id)
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'wallets:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'providers'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const skip = (page - 1) * limit

    if (!['providers', 'customers', 'transactions'].includes(type)) {
      return NextResponse.json({ error: 'Invalid wallet view' }, { status: 400 })
    }

    const countryFilter = getCrmCountryFilter(security)
    const userIds = security.isSuperAdmin ? null : await scopedUserIds(countryFilter)

    let providerWallets: any[] = []
    let customerWallets: any[] = []
    let transactions: any[] = []

    if (type === 'providers') {
      const wallets = await prisma.providerWallet.findMany({
        where: userIds ? { userId: { in: userIds } } : {},
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      })
      const ids = wallets.map(wallet => wallet.userId)
      const users = ids.length
        ? await prisma.user.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, email: true, mxId: true, countryCode: true },
          })
        : []
      const userMap = new Map(users.map(user => [user.id, user]))
      providerWallets = wallets.map(wallet => ({ ...wallet, user: userMap.get(wallet.userId) || null }))
    } else if (type === 'customers') {
      const wallets = await prisma.customerWallet.findMany({
        where: userIds ? { userId: { in: userIds } } : {},
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      })
      const ids = wallets.map(wallet => wallet.userId)
      const users = ids.length
        ? await prisma.user.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, email: true, mxId: true, countryCode: true },
          })
        : []
      const userMap = new Map(users.map(user => [user.id, user]))
      customerWallets = wallets.map(wallet => ({ ...wallet, user: userMap.get(wallet.userId) || null }))
    } else {
      const txns = await prisma.walletTransaction.findMany({
        where: userIds ? { userId: { in: userIds } } : {},
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      })
      const ids = [...new Set(txns.map(txn => txn.userId))]
      const users = ids.length
        ? await prisma.user.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, email: true, mxId: true, countryCode: true },
          })
        : []
      const userMap = new Map(users.map(user => [user.id, user]))
      transactions = txns.map(txn => ({ ...txn, user: userMap.get(txn.userId) || null }))
    }

    return NextResponse.json(
      { providerWallets, customerWallets, transactions },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM wallets GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch wallet data' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'wallets:manage',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const walletId = typeof body?.walletId === 'string' ? body.walletId : ''
    const action = typeof body?.action === 'string' ? body.action.toUpperCase() : ''

    if (!walletId || !['FREEZE', 'UNFREEZE'].includes(action)) {
      return NextResponse.json({ error: 'Invalid wallet action' }, { status: 400 })
    }

    const isFrozen = action === 'FREEZE'
    const providerWallet = await prisma.providerWallet.findUnique({
      where: { id: walletId },
      select: { id: true, userId: true },
    })

    if (providerWallet) {
      const walletUser = await prisma.user.findUnique({
        where: { id: providerWallet.userId },
        select: { countryCode: true },
      })
      if (!walletUser || !assertCrmCountryAllowed(security, walletUser.countryCode)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const updated = await prisma.providerWallet.update({
        where: { id: walletId },
        data: { isFrozen },
      })
      const audit = isFrozen ? auditWalletFreeze : auditWalletUnfreeze
      audit({ walletId, walletType: 'PROVIDER', actorId: security.adminId })
      return NextResponse.json({ wallet: updated })
    }

    const customerWallet = await prisma.customerWallet.findUnique({
      where: { id: walletId },
      select: { id: true, userId: true },
    })
    if (!customerWallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    const walletUser = await prisma.user.findUnique({
      where: { id: customerWallet.userId },
      select: { countryCode: true },
    })
    if (!walletUser || !assertCrmCountryAllowed(security, walletUser.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.customerWallet.update({
      where: { id: walletId },
      data: { isFrozen },
    })
    const audit = isFrozen ? auditWalletFreeze : auditWalletUnfreeze
    audit({ walletId, walletType: 'CUSTOMER', actorId: security.adminId })
    return NextResponse.json({ wallet: updated })
  } catch (error) {
    console.error('CRM wallets PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update wallet' }, { status: 500 })
  }
}
