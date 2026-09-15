import { NextRequest, NextResponse } from 'next/server'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { prisma } from '@/lib/prisma'
import { getWorkerActiveAssignments } from '@/lib/domain/company-job-assignment'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const membership = await prisma.teamMember.findFirst({
      where: { companyId, userId: user.id, status: 'ACTIVE' },
    })
    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this company' }, { status: 403 })
    }

    const assignments = await getWorkerActiveAssignments(user.id, companyId)

    return NextResponse.json({
      assignments: assignments.map((a: any) => ({
        id: a.id,
        status: a.status,
        assignedAt: a.assignedAt.toISOString(),
        acceptedAt: a.acceptedAt?.toISOString() || null,
        startedAt: a.startedAt?.toISOString() || null,
        job: a.job,
      })),
    })
  } catch (error) {
    console.error('Worker assignments error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
