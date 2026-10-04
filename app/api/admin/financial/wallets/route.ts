import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  getCrmCountryCodes,
  getCrmCountryFilter,
  guardCrmAction,
  guardCrmRequest,
} from '@/lib/crm/security'
import { evaluateActionInitiation } from '@/lib/crm/governance'
import { consumeCrmStepUpFromHeader } from '@/lib/crm/governance/step-up'
import { auditWalletFreeze, auditWalletUnfreeze } from '@/lib/financial-audit'
import { readCanonicalProviderBalance } from '@/lib/financial-read'

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
      permission: 'finance:wallets:view',
      permissionClass: 'READ',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'providers'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10) || 30))
    const skip = (page - 1) * limit

    if (!['providers', 'receivables', 'customers', 'transactions'].includes(type)) {
      return NextResponse.json({ error: 'Invalid wallet view' }, { status: 400 })
    }

    const countryFilter = getCrmCountryFilter(security)
    const scopedCountryCodes = getCrmCountryCodes(security)
    const userIds = scopedCountryCodes === null ? null : await scopedUserIds(countryFilter)
    const userWhere = userIds ? { userId: { in: userIds } } : {}

    const [
      providerSummaryRows,
      customerSummaryRows,
      frozenProviderRows,
      frozenCustomerRows,
    ] = await Promise.all([
      prisma.providerWallet.groupBy({
        by: ['currency'],
        where: userWhere,
        _sum: { availableBalance: true, pendingBalance: true },
        _count: { _all: true },
      }),
      prisma.customerWallet.groupBy({
        by: ['currency'],
        where: userWhere,
        _sum: { balance: true },
        _count: { _all: true },
      }),
      prisma.providerWallet.groupBy({
        by: ['currency'],
        where: { ...userWhere, isFrozen: true },
        _count: { _all: true },
      }),
      prisma.customerWallet.groupBy({
        by: ['currency'],
        where: { ...userWhere, isFrozen: true },
        _count: { _all: true },
      }),
    ])

    const summaryCurrencies = new Set<string>([
      ...providerSummaryRows.map(row => row.currency || 'LKR'),
      ...customerSummaryRows.map(row => row.currency || 'LKR'),
      ...frozenProviderRows.map(row => row.currency || 'LKR'),
      ...frozenCustomerRows.map(row => row.currency || 'LKR'),
    ])

    const summaryByCurrency = [...summaryCurrencies].sort().map(currency => {
      const provider = providerSummaryRows.find(row => (row.currency || 'LKR') === currency)
      const customer = customerSummaryRows.find(row => (row.currency || 'LKR') === currency)
      const frozenProviders = frozenProviderRows.find(row => (row.currency || 'LKR') === currency)
      const frozenCustomers = frozenCustomerRows.find(row => (row.currency || 'LKR') === currency)

      return {
        currency,
        providerAvailable: provider?._sum.availableBalance || 0,
        providerPending: provider?._sum.pendingBalance || 0,
        providerCount: provider?._count._all || 0,
        customerBalance: customer?._sum.balance || 0,
        customerCount: customer?._count._all || 0,
        frozenCount:
          (frozenProviders?._count._all || 0) +
          (frozenCustomers?._count._all || 0),
      }
    })

    let providerWallets: any[] = []
    let providerReceivables: any[] = []
    let customerWallets: any[] = []
    let transactions: any[] = []
    let total = 0

    if (type === 'providers') {
      const [wallets, count] = await Promise.all([
        prisma.providerWallet.findMany({
          where: userWhere,
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.providerWallet.count({ where: userWhere }),
      ])
      total = count

      const ids = wallets.map(wallet => wallet.userId)
      const users = ids.length
        ? await prisma.user.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, email: true, mxId: true, countryCode: true },
          })
        : []
      const userMap = new Map(users.map(user => [user.id, user]))
      providerWallets = wallets.map(wallet => ({
        ...wallet,
        user: userMap.get(wallet.userId) || null,
      }))
    } else if (type === 'receivables') {
      const identityWhere = userIds
        ? { providerIdentity: { currentUserId: { in: userIds } } }
        : {}

      const [accounts, count] = await Promise.all([
        prisma.providerFinancialAccount.findMany({
          where: identityWhere,
          include: {
            providerIdentity: {
              select: {
                id: true,
                identityType: true,
                subjectId: true,
                currentUserId: true,
                countryCode: true,
                kycStatus: true,
                standingStatus: true,
                commissionRecoveries: {
                  orderBy: { createdAt: 'desc' },
                  take: 5,
                  select: {
                    id: true,
                    sourceJobId: true,
                    amount: true,
                    currency: true,
                    method: true,
                    createdAt: true,
                    receivable: {
                      select: {
                        jobId: true,
                      },
                    },
                  },
                },
                balanceAdjustmentRecoveries: {
                  orderBy: { createdAt: 'desc' },
                  take: 5,
                  select: {
                    id: true,
                    sourceJobId: true,
                    amount: true,
                    currency: true,
                    method: true,
                    createdAt: true,
                    adjustment: {
                      select: {
                        id: true,
                        adjustmentType: true,
                        jobId: true,
                        sourceProvider: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [{ commissionDue: 'desc' }, { updatedAt: 'desc' }],
          skip,
          take: limit,
        }),
        prisma.providerFinancialAccount.count({ where: identityWhere }),
      ])
      total = count

      const ids = [...new Set(
        accounts
          .map(account => account.providerIdentity.currentUserId)
          .filter((value): value is string => Boolean(value))
      )]
      const users = ids.length
        ? await prisma.user.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, email: true, mxId: true, countryCode: true },
          })
        : []
      const userMap = new Map(users.map(user => [user.id, user]))
      const canonicalByAccountId = new Map(
        await Promise.all(
          accounts.map(async account => {
            const userId = account.providerIdentity.currentUserId
            if (!userId) return [account.id, null] as const
            const canonical = await readCanonicalProviderBalance(userId, account.currency as any)
            return [account.id, canonical] as const
          }),
        ),
      )

      providerReceivables = accounts.map(account => {
        const canonical = canonicalByAccountId.get(account.id)
        return ({
        id: account.id,
        providerIdentityId: account.providerIdentityId,
        identityType: account.providerIdentity.identityType,
        subjectId: account.providerIdentity.subjectId,
        currentUserId: account.providerIdentity.currentUserId,
        countryCode: account.providerIdentity.countryCode,
        kycStatus: account.providerIdentity.kycStatus,
        standingStatus: account.providerIdentity.standingStatus,
        currency: account.currency,
        commissionDueMinor: account.commissionDue.toString(),
        commissionDue: Number(account.commissionDue) / 100,
        adjustmentDueMinor: account.adjustmentDue.toString(),
        adjustmentDue: Number(account.adjustmentDue) / 100,
        totalLiabilityMinor: (account.commissionDue + account.adjustmentDue).toString(),
        availableEarningsMinor: (canonical?.availableBalance ?? 0n).toString(),
        pendingEarningsMinor: (canonical?.pendingBalance ?? 0n).toString(),
        status: account.status,
        cashJobsAllowed: account.cashJobsAllowed,
        onlineJobsAllowed: account.onlineJobsAllowed,
        manualReviewRequired: account.manualReviewRequired,
        oldestCommissionDueAt: account.oldestCommissionDueAt?.toISOString() ?? null,
        oldestAdjustmentDueAt: account.oldestAdjustmentDueAt?.toISOString() ?? null,
        updatedAt: account.updatedAt.toISOString(),
        recentRecoveries: account.providerIdentity.commissionRecoveries
          .filter(recovery => recovery.currency === account.currency)
          .map(recovery => ({
            id: recovery.id,
            amountMinor: recovery.amount.toString(),
            amount: Number(recovery.amount) / 100,
            currency: recovery.currency,
            method: recovery.method,
            sourceJobId: recovery.sourceJobId,
            originalCashJobId: recovery.receivable.jobId,
            createdAt: recovery.createdAt.toISOString(),
          })),
        recentAdjustmentRecoveries: account.providerIdentity.balanceAdjustmentRecoveries
          .filter(recovery => recovery.currency === account.currency)
          .map(recovery => ({
            id: recovery.id,
            amountMinor: recovery.amount.toString(),
            amount: Number(recovery.amount) / 100,
            currency: recovery.currency,
            method: recovery.method,
            sourceJobId: recovery.sourceJobId,
            adjustmentId: recovery.adjustment.id,
            adjustmentType: recovery.adjustment.adjustmentType,
            originalJobId: recovery.adjustment.jobId,
            sourceProvider: recovery.adjustment.sourceProvider,
            createdAt: recovery.createdAt.toISOString(),
          })),
        user: account.providerIdentity.currentUserId
          ? userMap.get(account.providerIdentity.currentUserId) || null
          : null,
        })
      })
    } else if (type === 'customers') {
      const [wallets, count] = await Promise.all([
        prisma.customerWallet.findMany({
          where: userWhere,
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.customerWallet.count({ where: userWhere }),
      ])
      total = count

      const ids = wallets.map(wallet => wallet.userId)
      const users = ids.length
        ? await prisma.user.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, email: true, mxId: true, countryCode: true },
          })
        : []
      const userMap = new Map(users.map(user => [user.id, user]))
      customerWallets = wallets.map(wallet => ({
        ...wallet,
        user: userMap.get(wallet.userId) || null,
      }))
    } else {
      const [txns, count] = await Promise.all([
        prisma.walletTransaction.findMany({
          where: userWhere,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.walletTransaction.count({ where: userWhere }),
      ])
      total = count

      const ids = [...new Set(txns.map(txn => txn.userId))]
      const users = ids.length
        ? await prisma.user.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, email: true, mxId: true, countryCode: true },
          })
        : []
      const userMap = new Map(users.map(user => [user.id, user]))
      transactions = txns.map(txn => ({
        ...txn,
        user: userMap.get(txn.userId) || null,
      }))
    }

    return NextResponse.json(
      {
        providerWallets,
        providerReceivables,
        customerWallets,
        transactions,
        summaryByCurrency,
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
        actions: {
          freeze: evaluateActionInitiation({
            role: security.role,
            actionId: 'finance.wallet.freeze',
            overrides: security.permissionOverrides,
          }).allowed,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM wallets GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch wallet data' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmAction(request, 'finance.wallet.freeze')
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const walletId = typeof body?.walletId === 'string' ? body.walletId.trim().slice(0, 128) : ''
    const action = typeof body?.action === 'string' ? body.action.toUpperCase() : ''

    if (!walletId || !['FREEZE', 'UNFREEZE'].includes(action)) {
      return NextResponse.json({ error: 'Invalid wallet action' }, { status: 400 })
    }

    const providerWallet = await prisma.providerWallet.findUnique({
      where: { id: walletId },
      select: { id: true, userId: true, isFrozen: true },
    })
    const customerWallet = providerWallet
      ? null
      : await prisma.customerWallet.findUnique({
          where: { id: walletId },
          select: { id: true, userId: true, isFrozen: true },
        })

    const wallet = providerWallet || customerWallet
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    const walletType = providerWallet ? 'PROVIDER' : 'CUSTOMER'
    const walletUser = await prisma.user.findUnique({
      where: { id: wallet.userId },
      select: { id: true, name: true, countryCode: true },
    })
    if (!walletUser || !assertCrmCountryAllowed(security, walletUser.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const stepUp = await consumeCrmStepUpFromHeader({
      headerValue: request.headers.get('x-crm-step-up'),
      adminUserId: security.adminId,
      sessionId: security.sessionId,
      actionId: 'finance.wallet.freeze',
    })
    if (!stepUp) {
      return NextResponse.json(
        { error: 'Step-up authentication required', code: 'STEP_UP_REQUIRED' },
        { status: 403 }
      )
    }

    const isFrozen = action === 'FREEZE'
    if (wallet.isFrozen === isFrozen) {
      return NextResponse.json({
        wallet: {
          id: wallet.id,
          isFrozen,
          unchanged: true,
        },
      })
    }

    const updated = await prisma.$transaction(async tx => {
      const result = providerWallet
        ? await tx.providerWallet.update({
            where: { id: walletId },
            data: { isFrozen },
          })
        : await tx.customerWallet.update({
            where: { id: walletId },
            data: { isFrozen },
          })

      await tx.securityAudit.create({
        data: {
          action: 'UPDATE',
          category: 'FINANCE',
          userId: security.adminId,
          userEmail: security.email,
          userRole: security.role,
          entityType: `${walletType}Wallet`,
          entityId: walletId,
          entityName: walletUser.name || walletUser.id,
          description: isFrozen ? 'CRM wallet frozen' : 'CRM wallet unfrozen',
          oldValue: JSON.stringify({ isFrozen: wallet.isFrozen }),
          newValue: JSON.stringify({
            isFrozen,
            walletType,
            countryCode: walletUser.countryCode,
          }),
          ipAddress: security.ipAddress,
          userAgent: security.userAgent || undefined,
          riskLevel: 'HIGH',
          isSuspicious: false,
        },
      })

      return result
    })

    const audit = isFrozen ? auditWalletFreeze : auditWalletUnfreeze
    audit({
      walletId,
      walletType,
      actorId: security.adminId,
    })

    return NextResponse.json({ wallet: updated })
  } catch (error) {
    console.error('CRM wallets PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update wallet' }, { status: 500 })
  }
}
