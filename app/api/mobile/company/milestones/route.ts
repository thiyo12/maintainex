import { secureConsole } from '@/lib/shared/observability/secure-console'
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
    const status = searchParams.get('status')

    const { context, error } = await resolveCompanyContext(user.id, companyId, 'jobs:read')
    if (error) return error

    const where: any = {
      contract: { companyId: context!.companyId },
    }
    if (status) where.status = status

    const milestones = await prisma.milestone.findMany({
      where,
      include: {
        contract: { select: { title: true, clientName: true } },
      },
      orderBy: { dueDate: 'asc' },
    })

    return NextResponse.json(
      milestones.map(m => ({
        id: m.id,
        contractTitle: m.contract.title,
        clientName: m.contract.clientName,
        title: m.title,
        description: m.description,
        amount: m.amount,
        status: m.status,
        dueDate: m.dueDate?.toISOString(),
        completedAt: m.completedAt?.toISOString(),
        createdAt: m.createdAt.toISOString(),
      }))
    )
  } catch (error) {
    secureConsole.error('Milestones list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
