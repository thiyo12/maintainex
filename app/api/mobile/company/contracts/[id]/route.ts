import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contract = await prisma.contract.findFirst({
      where: {
        id: params.id,
        company: { userId: user.id },
      },
      include: {
        milestones: { orderBy: { dueDate: 'asc' } },
        company: { select: { id: true, companyName: true } },
      },
    })

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: contract.id,
      clientName: contract.clientName,
      title: contract.title,
      description: contract.description,
      value: contract.value,
      status: contract.status,
      progress: contract.progress,
      startDate: contract.startDate?.toISOString(),
      endDate: contract.endDate?.toISOString(),
      companyName: contract.company.companyName,
      createdAt: contract.createdAt.toISOString(),
      milestones: contract.milestones.map(m => ({
        id: m.id,
        title: m.title,
        description: m.description,
        amount: m.amount,
        status: m.status,
        dueDate: m.dueDate?.toISOString(),
        completedAt: m.completedAt?.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Contract get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { status, progress } = await request.json()
    const updateData: any = {}
    if (status) updateData.status = status
    if (progress !== undefined) updateData.progress = progress

    const contract = await prisma.contract.updateMany({
      where: { id: params.id, company: { userId: user.id } },
      data: updateData,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Contract update error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
