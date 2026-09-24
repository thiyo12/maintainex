import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { resolveCompanyContext } from '@/lib/phase6/company-context'

function toMajor(value: bigint): number {
  return Number(value) / 100
}

function mondayUtc(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    const { context, error } = await resolveCompanyContext(user.id, companyId, 'finance:read')
    if (error) return error

    const company = await prisma.companyProfile.findUnique({
      where: { id: context!.companyId },
      select: { id: true, userId: true, companyName: true, commissionRate: true },
    })
    if (!company) return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })

    const [settlements, contracts] = await Promise.all([
      prisma.commissionSettlement.findMany({
        where: { providerId: company.userId },
        orderBy: { createdAt: 'desc' },
        take: 250,
      }),
      prisma.contract.findMany({
        where: { companyId: company.id },
        include: { milestones: true },
      }),
    ])

    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const weekStart = mondayUtc(now)
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

    const marketplaceGross = settlements.reduce((sum, row) => sum + toMajor(row.jobAmount), 0)
    const marketplaceCommission = settlements.reduce((sum, row) => sum + toMajor(row.commissionAmount), 0)
    const marketplaceNet = marketplaceGross - marketplaceCommission

    const monthRows = settlements.filter(row => row.createdAt >= monthStart)
    const monthlyRevenue = monthRows.reduce((sum, row) => sum + toMajor(row.jobAmount - row.commissionAmount), 0)

    const currentWeekRows = settlements.filter(row => row.createdAt >= weekStart && row.createdAt < weekEnd)
    const currentWeek = {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      gross: currentWeekRows.reduce((sum, row) => sum + toMajor(row.jobAmount), 0),
      commission: currentWeekRows.reduce((sum, row) => sum + toMajor(row.commissionAmount), 0),
      net: currentWeekRows.reduce((sum, row) => sum + toMajor(row.jobAmount - row.commissionAmount), 0),
      jobs: currentWeekRows.length,
      pendingReconciliation: currentWeekRows.filter(row => row.status === 'PENDING').length,
    }

    const weeklyMap = new Map<string, {
      weekStart: Date
      gross: number
      commission: number
      net: number
      jobs: number
      pending: number
    }>()

    for (const row of settlements) {
      const start = mondayUtc(row.createdAt)
      const key = start.toISOString()
      const bucket = weeklyMap.get(key) || { weekStart: start, gross: 0, commission: 0, net: 0, jobs: 0, pending: 0 }
      const gross = toMajor(row.jobAmount)
      const commission = toMajor(row.commissionAmount)
      bucket.gross += gross
      bucket.commission += commission
      bucket.net += gross - commission
      bucket.jobs += 1
      if (row.status === 'PENDING') bucket.pending += 1
      weeklyMap.set(key, bucket)
    }

    const weeklyStatements = [...weeklyMap.values()]
      .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())
      .slice(0, 12)
      .map(bucket => {
        const end = new Date(bucket.weekStart)
        end.setUTCDate(end.getUTCDate() + 7)
        return {
          weekStart: bucket.weekStart.toISOString(),
          weekEnd: end.toISOString(),
          gross: bucket.gross,
          commission: bucket.commission,
          net: bucket.net,
          jobs: bucket.jobs,
          reconciliationStatus: bucket.pending > 0 ? 'PENDING' : 'SETTLED',
        }
      })

    const legacyContractRevenue = contracts.reduce((sum, contract) => sum + contract.value, 0)

    return NextResponse.json({
      currency: 'LKR',
      commissionRate: company.commissionRate,
      marketplaceGross,
      marketplaceCommission,
      marketplaceNet,
      totalRevenue: marketplaceNet + legacyContractRevenue,
      monthlyRevenue,
      completedRevenue: marketplaceNet,
      pendingRevenue: 0,
      contractCount: contracts.length,
      completedCount: settlements.length,
      pendingCount: settlements.filter(row => row.status === 'PENDING').length,
      currentWeek,
      weeklyStatements,
      settlements: settlements.slice(0, 50).map(row => ({
        id: row.id,
        jobId: row.jobId,
        gross: toMajor(row.jobAmount),
        commissionRate: row.commissionRate,
        commission: toMajor(row.commissionAmount),
        net: toMajor(row.jobAmount - row.commissionAmount),
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        settledAt: row.settledAt?.toISOString() || null,
      })),
      milestones: contracts.flatMap(contract =>
        contract.milestones.map(milestone => ({
          contractTitle: contract.title,
          clientName: contract.clientName,
          title: milestone.title,
          amount: milestone.amount,
          status: milestone.status,
          completedAt: milestone.completedAt?.toISOString(),
        }))
      ),
      note: 'Commission is withheld once per completed job. Weekly statements are reconciliation only; no second deduction occurs.',
    })
  } catch (error) {
    console.error('Company earnings error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
