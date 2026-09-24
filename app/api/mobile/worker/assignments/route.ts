import { NextRequest, NextResponse } from 'next/server'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { prisma } from '@/lib/prisma'
import { getWorkerActiveAssignments } from '@/lib/domain/company-job-assignment'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    let assignments: any[] = []

    if (companyId) {
      const membership = await prisma.teamMember.findFirst({
        where: { companyId, userId: user.id, status: 'ACTIVE' },
        select: { id: true },
      })
      if (!membership) return NextResponse.json({ error: 'Not a member of this company' }, { status: 403 })
      assignments = await getWorkerActiveAssignments(user.id, companyId)
    } else {
      const memberships = await prisma.teamMember.findMany({
        where: { userId: user.id, status: 'ACTIVE' },
        select: { companyId: true },
      })
      const companyIds = memberships.map((membership) => membership.companyId)
      if (companyIds.length) {
        assignments = await prisma.companyJobAssignment.findMany({
          where: {
            workerUserId: user.id,
            companyId: { in: companyIds },
            status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
          },
          include: {
            job: {
              select: {
                id: true,
                title: true,
                status: true,
                preferredDate: true,
                preferredTimeSlot: true,
                addressStreet: true,
                budgetAmount: true,
                countryCode: true,
              },
            },
            company: { select: { id: true, companyName: true } },
          },
          orderBy: { assignedAt: 'desc' },
        })
      }
    }

    return NextResponse.json({
      assignments: assignments.map((assignment: any) => ({
        id: assignment.id,
        companyId: assignment.companyId,
        companyName: assignment.company?.companyName || null,
        status: assignment.status,
        assignedAt: assignment.assignedAt.toISOString(),
        acceptedAt: assignment.acceptedAt?.toISOString() || null,
        startedAt: assignment.startedAt?.toISOString() || null,
        job: {
          ...assignment.job,
          budgetAmount: assignment.job?.budgetAmount != null
            ? Number(assignment.job.budgetAmount)
            : null,
        },
      })),
    })
  } catch (error) {
    console.error('Worker assignments error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
