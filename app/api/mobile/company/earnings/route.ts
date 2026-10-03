import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { bigIntToSafeNumber, getCurrencyForCountry } from '@/lib/shared/money/money'
import { readCanonicalProviderBalance } from '@/lib/financial-read'

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

    const company = await prisma.companyProfile.findUnique({
      where: { id: context!.companyId },
      select: { userId: true, countryCode: true },
    })
    if (!company) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
    }

    const currency = getCurrencyForCountry(company.countryCode || 'LK')
    const canonicalBalance = await readCanonicalProviderBalance(company.userId, currency)
    const financialIdentity = await prisma.providerIdentity.findUnique({
      where: {
        identityType_subjectId: {
          identityType: 'COMPANY',
          subjectId: context!.companyId,
        },
      },
      select: { id: true },
    })
    const financialAccount = financialIdentity
      ? await prisma.providerFinancialAccount.findUnique({
          where: {
            providerIdentityId_currency: {
              providerIdentityId: financialIdentity.id,
              currency,
            },
          },
        })
      : null

    const recentCommissionRecoveries = financialIdentity
      ? await prisma.providerCommissionRecovery.findMany({
          where: {
            providerIdentityId: financialIdentity.id,
            currency,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            sourceJobId: true,
            sourceEscrowId: true,
            amount: true,
            currency: true,
            method: true,
            createdAt: true,
            receivable: {
              select: {
                jobId: true,
                escrowId: true,
              },
            },
          },
        })
      : []

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
        providerId: company.userId,
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
      recentCommissionRecoveries: recentCommissionRecoveries.map(recovery => ({
        id: recovery.id,
        amountMinor: recovery.amount.toString(),
        amount: bigIntToSafeNumber(recovery.amount) / 100,
        currency: recovery.currency,
        method: recovery.method,
        sourceJobId: recovery.sourceJobId,
        sourceEscrowId: recovery.sourceEscrowId,
        originalCashJobId: recovery.receivable.jobId,
        createdAt: recovery.createdAt.toISOString(),
      })),
      maintainexBalance: {
        commissionDueMinor: (financialAccount?.commissionDue ?? 0n).toString(),
        commissionDue: bigIntToSafeNumber(financialAccount?.commissionDue ?? 0n) / 100,
        availableEarningsMinor: (canonicalBalance?.availableBalance ?? 0n).toString(),
        pendingEarningsMinor: (canonicalBalance?.pendingBalance ?? 0n).toString(),
        availableEarnings: bigIntToSafeNumber(canonicalBalance?.availableBalance ?? 0n) / 100,
        pendingEarnings: bigIntToSafeNumber(canonicalBalance?.pendingBalance ?? 0n) / 100,
        status: financialAccount?.status ?? 'CLEAR',
        cashJobsAllowed: financialAccount?.cashJobsAllowed ?? true,
        onlineJobsAllowed: financialAccount?.onlineJobsAllowed ?? true,
        manualReviewRequired: financialAccount?.manualReviewRequired ?? false,
        oldestCommissionDueAt: financialAccount?.oldestCommissionDueAt?.toISOString() ?? null,
        currency,
      },
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
