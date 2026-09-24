import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { resolveProviderActor } from '@/lib/domain/job-lifecycle'

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
    const providerActor = isCustomer ? null : await resolveProviderActor(job.id, user.id)
    if (!isCustomer && !providerActor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId: job.id } })
    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id } })

    const quote = await prisma.jobQuote.findFirst({
      where: { jobId: job.id, status: 'ACCEPTED' },
    })
    let location = null
    if (quote?.providerType === 'INDIVIDUAL') {
      const taskerProfile = await prisma.taskerProfile.findUnique({
        where: { userId: quote.providerId },
        select: { latitude: true, longitude: true, locationUpdatedAt: true },
      })
      if (taskerProfile?.latitude != null && taskerProfile?.longitude != null) {
        location = {
          providerId: quote.providerId,
          latitude: taskerProfile.latitude,
          longitude: taskerProfile.longitude,
          updatedAt: taskerProfile.locationUpdatedAt,
          source: 'TASKER',
        }
      }
    } else if (quote?.providerType === 'COMPANY') {
      const assignment = await prisma.companyJobAssignment.findFirst({
        where: {
          jobId: job.id,
          companyId: quote.providerId,
          status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
        },
        orderBy: { updatedAt: 'desc' },
        select: { workerUserId: true },
      })

      if (assignment) {
        const workerProfile = await prisma.taskerProfile.findUnique({
          where: { userId: assignment.workerUserId },
          select: { latitude: true, longitude: true, locationUpdatedAt: true },
        })
        if (workerProfile?.latitude != null && workerProfile?.longitude != null) {
          location = {
            providerId: assignment.workerUserId,
            latitude: workerProfile.latitude,
            longitude: workerProfile.longitude,
            updatedAt: workerProfile.locationUpdatedAt,
            source: 'COMPANY_WORKER',
          }
        }
      }
    }

    const sharing =
      workspace?.progressStatus === 'ACCEPTED' || workspace?.progressStatus === 'IN_PROGRESS'

    return NextResponse.json({
      sharing: !!location && sharing,
      location,
    })
  } catch (error) {
    console.error('Get tasker location error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}