import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'

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
    const status = searchParams.get('status')

    const where: any = { companyId: profile.id }
    if (status) where.status = status

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        milestones: {
          orderBy: { dueDate: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(
      contracts.map(c => ({
        id: c.id,
        clientName: c.clientName,
        title: c.title,
        description: c.description,
        value: c.value,
        status: c.status,
        progress: c.progress,
        startDate: c.startDate?.toISOString(),
        endDate: c.endDate?.toISOString(),
        createdAt: c.createdAt.toISOString(),
        milestones: c.milestones.map(m => ({
          id: m.id,
          title: m.title,
          amount: m.amount,
          status: m.status,
          dueDate: m.dueDate?.toISOString(),
        })),
      }))
    )
  } catch (error) {
    secureConsole.error('Contracts list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
