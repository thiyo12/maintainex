import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { reconcilePriorWeekCommissions, startOfCurrentUtcWeek } from '@/lib/commission-reconcile'
import { bigIntToSafeNumber } from '@/lib/money'

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

    // Reconciliation moves no money; it only closes prior-week records that
    // were already withheld at escrow release. This makes finance state
    // self-healing even if the external weekly cron is delayed.
    await reconcilePriorWeekCommissions().catch(error => {
      console.error('Commission reconciliation on earnings read failed:', error)
    })

    const companyProfile = await prisma.companyProfile.findUnique({
      where: { id: context!.companyId },
      select: { userId: true, commissionRate: true },
    })
    if (!companyProfile) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
    }

    const contracts = await prisma.contract.findMany({
      where: { companyId: context!.companyId },
      include: { milestones: true },
    })

    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)
    const weekStart = startOfCurrentUtcWeek()

    const [marketplaceSettlements, weeklySettlements] = await Promise.all([
      prisma.commissionSettlement.findMany({
        where: {
          providerId: companyProfile.userId,
          createdAt: { gte: monthStart },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.commissionSettlement.findMany({
        where: {
          providerId: companyProfile.userId,
          createdAt: { gte: weekStart },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const marketplaceGross = marketplaceSettlements.reduce((sum, item) => sum + item.jobAmount, 0n)
    const marketplaceCommission = marketplaceSettlements.reduce((sum, item) => sum + item.commissionAmount, 0n)
    const marketplaceNet = marketplaceGross - marketplaceCommission

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

    return NextResponse.json({
      monthlyRevenue: bigIntToSafeNumber(marketplaceNet) / 100,
      marketplaceGross: bigIntToSafeNumber(marketplaceGross) / 100,
      marketplaceCommission: bigIntToSafeNumber(marketplaceCommission) / 100,
      marketplaceNet: bigIntToSafeNumber(marketplaceNet) / 100,
      commissionRate: companyProfile.commissionRate,
      marketplaceCurrency: marketplaceSettlements[0]?.currency || 'LKR',
      currentWeek: {
        weekStart: weekStart.toISOString(),
        jobs: weeklySettlements.length,
        gross: bigIntToSafeNumber(weeklySettlements.reduce((sum, item) => sum + item.jobAmount, 0n)) / 100,
        commission: bigIntToSafeNumber(weeklySettlements.reduce((sum, item) => sum + item.commissionAmount, 0n)) / 100,
        net: bigIntToSafeNumber(weeklySettlements.reduce((sum, item) => sum + item.jobAmount - item.commissionAmount, 0n)) / 100,
      },
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
