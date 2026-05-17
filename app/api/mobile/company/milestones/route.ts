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
    const status = searchParams.get('status')

    const where: any = {
      contract: { companyId: profile.id },
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
    console.error('Milestones list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
