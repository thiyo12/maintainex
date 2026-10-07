import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(_request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const isCustomer = job.customerId === user.id
    const quote = await prisma.jobQuote.findFirst({
      where: { jobId: job.id, status: 'ACCEPTED' },
      select: { providerId: true, providerType: true },
    })
    if (!quote) {
      return NextResponse.json({ sharing: false, location: null })
    }

    let providerUserId: string | null = null
    let isAcceptedProvider = false

    if (quote.providerType === 'INDIVIDUAL') {
      providerUserId = quote.providerId
      isAcceptedProvider = user.id === quote.providerId
    } else {
      const assignment = await prisma.companyJobAssignment.findFirst({
        where: {
          jobId: job.id,
          companyId: quote.providerId,
          status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
        },
        select: { workerUserId: true },
      })
      providerUserId = assignment?.workerUserId ?? null

      if (providerUserId === user.id) {
        isAcceptedProvider = true
      } else {
        const manager = await prisma.teamMember.findFirst({
          where: {
            companyId: quote.providerId,
            userId: user.id,
            status: 'ACTIVE',
            role: { in: ['COMPANY_OWNER', 'MANAGER', 'DISPATCHER'] },
          },
          select: { id: true },
        })
        isAcceptedProvider = !!manager
      }
    }

    if (!isCustomer && !isAcceptedProvider) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [workspace, protectedEscrow] = await Promise.all([
      prisma.jobWorkspace.findUnique({ where: { jobId: job.id } }),
      prisma.jobEscrow.findFirst({
        where: { jobId: job.id, status: 'PROTECTED' },
        select: { id: true },
      }),
    ])

    const sharing =
      !!protectedEscrow &&
      (workspace?.progressStatus === 'ACCEPTED' || workspace?.progressStatus === 'IN_PROGRESS')

    if (!sharing || !providerUserId) {
      return NextResponse.json({ sharing: false, location: null })
    }

    const taskerProfile = await prisma.taskerProfile.findUnique({
      where: { userId: providerUserId },
      select: { latitude: true, longitude: true, locationUpdatedAt: true },
    })

    const location =
      taskerProfile?.latitude != null && taskerProfile.longitude != null
        ? {
            providerId: providerUserId,
            latitude: taskerProfile.latitude,
            longitude: taskerProfile.longitude,
            updatedAt: taskerProfile.locationUpdatedAt,
          }
        : null

    return NextResponse.json({
      sharing: !!location,
      location,
    })
  } catch (error) {
    secureConsole.error('Get tasker location error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}