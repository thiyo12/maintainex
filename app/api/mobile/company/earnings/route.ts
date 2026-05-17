import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.companyProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!profile) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'monthly'

    const contracts = await prisma.contract.findMany({
      where: { companyId: profile.id },
      include: { milestones: true },
    })

    const totalRevenue = contracts.reduce((sum, c) => sum + c.value, 0)
    const completedContracts = contracts.filter(c => c.status === 'COMPLETED')
    const completedRevenue = completedContracts.reduce((sum, c) => sum + c.value, 0)
    const pendingRevenue = contracts
      .filter(c => c.status === 'IN_PROGRESS')
      .reduce((sum, c) => sum + c.value, 0)

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
    })
  } catch (error) {
    console.error('Company earnings error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
