import { NextRequest, NextResponse } from 'next/server'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const requestedCompanyId = searchParams.get('companyId')

    const memberships = await prisma.teamMember.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        ...(requestedCompanyId ? { companyId: requestedCompanyId } : {}),
      },
      select: {
        companyId: true,
        role: true,
        company: { select: { id: true, companyName: true, logo: true } },
      },
    })

    if (requestedCompanyId && memberships.length === 0) {
      return NextResponse.json({ error: 'Not a member of this company' }, { status: 403 })
    }

    if (memberships.length === 0) {
      return NextResponse.json({ assignments: [], companies: [] })
    }

    const companyIds = memberships.map(membership => membership.companyId)
    const assignments = await prisma.companyJobAssignment.findMany({
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
            areaId: true,
            countryCode: true,
          },
        },
        company: { select: { id: true, companyName: true, logo: true } },
      },
      orderBy: { assignedAt: 'desc' },
    })

    return NextResponse.json({
      assignments: assignments.map(assignment => ({
        id: assignment.id,
        companyId: assignment.companyId,
        status: assignment.status,
        assignedAt: assignment.assignedAt.toISOString(),
        acceptedAt: assignment.acceptedAt?.toISOString() || null,
        startedAt: assignment.startedAt?.toISOString() || null,
        job: assignment.job,
        company: assignment.company,
      })),
      companies: memberships.map(membership => ({
        id: membership.company.id,
        companyName: membership.company.companyName,
        logo: membership.company.logo,
        role: membership.role,
      })),
    })
  } catch (error) {
    console.error('Worker assignments error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
