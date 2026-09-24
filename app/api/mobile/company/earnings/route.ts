import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { resolveCompanyContext } from '@/lib/phase6/company-context'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const period = searchParams.get('period') || 'monthly'

    const { context, error } = await resolveCompanyContext(user.id, companyId, 'finance:read')
    if (error) return error

    const companyProfile = await prisma.companyProfile.findUnique({
      where: { id: context!.companyId },
      select: { id: true, userId: true, commissionRate: true, countryCode: true },
    })
    if (!companyProfile) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
    }

    const contracts = await prisma.contract.findMany({
      where: { companyId: context!.companyId },
      include: { milestones: true },
    })

    const marketplaceSettlements = await prisma.commissionSettlement.findMany({
      where: { providerId: companyProfile.userId },
      orderBy: { createdAt: 'desc' },
      take: 250,
    })

    const totalRevenue = contracts.reduce((sum, c) => sum + c.value, 0)
    const completedContracts = contracts.filter(c => c.status === 'COMPLETED')
    const completedRevenue = completedContracts.reduce((sum, c) => sum + c.value, 0)
    const pendingRevenue = contracts
      .filter(c => c.status === 'IN_PROGRESS')
      .reduce((sum, c) => sum + c.value, 0)

    const pendingCommissionPayments = await prisma.commissionPayment.findMany({
      where: {
        providerId: user.id,
        status: 'PENDING',
      },
      include: {
        weeklySettlement: {
          select: {
            weekStart: true,
            weekEnd: true,
            commissionOwed: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    })

    const marketplaceGrossCents = marketplaceSettlements.reduce((sum, settlement) => sum + settlement.jobAmount, 0n)
    const marketplaceCommissionCents = marketplaceSettlements.reduce((sum, settlement) => sum + settlement.commissionAmount, 0n)
    const marketplaceNetCents = marketplaceGrossCents - marketplaceCommissionCents

    const mondayStart = (date: Date) => {
      const d = new Date(date)
      d.setHours(0, 0, 0, 0)
      const day = d.getDay()
      const diff = day === 0 ? -6 : 1 - day
      d.setDate(d.getDate() + diff)
      return d
    }

    const weeklyMap = new Map<string, {
      weekStart: Date
      grossCents: bigint
      commissionCents: bigint
      jobs: number
      pendingReconciliation: number
      currency: string
    }>()

    for (const settlement of marketplaceSettlements) {
      const weekStart = mondayStart(settlement.createdAt)
      const key = weekStart.toISOString().slice(0, 10)
      const row = weeklyMap.get(key) || {
        weekStart,
        grossCents: 0n,
        commissionCents: 0n,
        jobs: 0,
        pendingReconciliation: 0,
        currency: settlement.currency,
      }
      row.grossCents += settlement.jobAmount
      row.commissionCents += settlement.commissionAmount
      row.jobs += 1
      if (settlement.status === 'PENDING') row.pendingReconciliation += 1
      weeklyMap.set(key, row)
    }

    const weeklyCommissionStatements = [...weeklyMap.values()]
      .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())
      .slice(0, 12)
      .map((row) => {
        const weekEnd = new Date(row.weekStart)
        weekEnd.setDate(weekEnd.getDate() + 6)
        return {
          weekStart: row.weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
          jobs: row.jobs,
          grossAmount: Number(row.grossCents) / 100,
          commissionRate: companyProfile.commissionRate,
          commissionWithheld: Number(row.commissionCents) / 100,
          netPayout: Number(row.grossCents - row.commissionCents) / 100,
          amountDue: 0,
          currency: row.currency,
          reconciliationStatus: row.pendingReconciliation > 0 ? 'PENDING_RECONCILIATION' : 'RECONCILED',
        }
      })

    return NextResponse.json({
      commissionCollectionMode: 'WITHHELD_PER_JOB',
      commissionRate: companyProfile.commissionRate,
      currency: marketplaceSettlements[0]?.currency || (companyProfile.countryCode === 'CA' ? 'CAD' : 'LKR'),
      marketplaceRevenue: Number(marketplaceGrossCents) / 100,
      marketplaceCommissionWithheld: Number(marketplaceCommissionCents) / 100,
      marketplaceNetPayout: Number(marketplaceNetCents) / 100,
      weeklyCommissionStatements,
      totalRevenue,
      completedRevenue,
      pendingRevenue,
      contractCount: contracts.length,
      completedCount: completedContracts.length,
      pendingCount: contracts.filter(c => c.status === 'IN_PROGRESS').length,
      milestones: contracts.flatMap(c =>
        c.milestones.map(m => ({
          contractTitle: c.title,
          clientName: c.clientName,
          title: m.title,
          amount: m.amount,
          status: m.status,
          completedAt: m.completedAt?.toISOString(),
        }))
      ),
      pendingCommissionPayments: pendingCommissionPayments.map(cp => ({
        id: cp.id,
        referenceNumber: cp.referenceNumber,
        amountDue: cp.amountDue,
        method: cp.method,
        weekStart: cp.weeklySettlement.weekStart.toISOString(),
        weekEnd: cp.weeklySettlement.weekEnd.toISOString(),
        dueAt: cp.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Company earnings error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
