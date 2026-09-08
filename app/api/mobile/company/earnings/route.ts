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

    const contracts = await prisma.contract.findMany({
      where: { companyId: context!.companyId },
      include: { milestones: true },
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

    return NextResponse.json({
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
