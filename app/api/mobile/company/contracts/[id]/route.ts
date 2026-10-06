import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contract = await prisma.contract.findFirst({
      where: {
        id,
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
    secureConsole.error('Contract get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { status, progress } = await request.json()
    const updateData: { status?: string; progress?: number } = {}

    if (status !== undefined) {
      const normalizedStatus = typeof status === 'string' ? status.trim().toUpperCase() : ''
      if (!['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(normalizedStatus)) {
        return NextResponse.json({ error: 'Invalid contract status' }, { status: 400 })
      }
      updateData.status = normalizedStatus
    }

    if (progress !== undefined) {
      const normalizedProgress = Number(progress)
      if (!Number.isInteger(normalizedProgress) || normalizedProgress < 0 || normalizedProgress > 100) {
        return NextResponse.json({ error: 'progress must be an integer from 0 to 100' }, { status: 400 })
      }
      updateData.progress = normalizedProgress
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    const contract = await prisma.contract.updateMany({
      where: { id, company: { userId: user.id } },
      data: updateData,
    })
    if (contract.count !== 1) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    secureConsole.error('Contract update error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
