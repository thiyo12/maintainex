import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { transitionJobWorkspace, type ActorType, type WorkspaceStatus } from '@/lib/domain/job-lifecycle'

async function resolveJobActor(jobId: string, customerId: string, userId: string): Promise<ActorType | null> {
  if (customerId === userId) return 'CUSTOMER'

  const acceptedQuote = await prisma.jobQuote.findFirst({
    where: { jobId, status: 'ACCEPTED' },
    select: { providerId: true, providerType: true },
  })
  if (!acceptedQuote) return null

  if (acceptedQuote.providerType === 'INDIVIDUAL' && acceptedQuote.providerId === userId) return 'PROVIDER'

  if (acceptedQuote.providerType === 'COMPANY') {
    const membership = await prisma.teamMember.findFirst({
      where: { companyId: acceptedQuote.providerId, userId, status: 'ACTIVE' },
      select: { id: true },
    })
    if (membership) return 'COMPANY'
  }

  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const actorType = await resolveJobActor(job.id, job.customerId, user.id)
    if (!actorType) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId: id } })
    return NextResponse.json({ workspace: workspace || null })
  } catch (error) {
    secureConsole.error('Get workspace error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const progressStatus = body.progressStatus as WorkspaceStatus
    const validStatuses: WorkspaceStatus[] = ['IN_PROGRESS', 'WAITING_CUSTOMER']
    if (!progressStatus || !validStatuses.includes(progressStatus)) {
      return NextResponse.json(
        { error: 'This workspace endpoint only supports WAITING_CUSTOMER and resume to IN_PROGRESS' },
        { status: 400 }
      )
    }

    const job = await prisma.marketplaceJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Workspace pause/resume is only available after work has started' },
        { status: 409 }
      )
    }

    const actorType = await resolveJobActor(job.id, job.customerId, user.id)
    if (!actorType) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    if (progressStatus === 'WAITING_CUSTOMER' && actorType === 'CUSTOMER') {
      return NextResponse.json(
        { error: 'Only the assigned provider can mark the job as waiting for the customer' },
        { status: 403 }
      )
    }
    if (progressStatus === 'IN_PROGRESS' && actorType !== 'CUSTOMER') {
      return NextResponse.json(
        { error: 'Only the customer can resume a job that is waiting for customer input' },
        { status: 403 }
      )
    }

    const updated = await transitionJobWorkspace(
      { jobId: job.id, actorId: user.id, actorType },
      progressStatus
    )

    return NextResponse.json({ workspace: updated })
  } catch (error: any) {
    secureConsole.error('Update workspace error:', error)
    const message = error?.message || 'Server error'
    if (
      message.includes('cannot transition') ||
      message.includes('Cannot transition') ||
      message.includes('Actor type') ||
      message.includes('requires PIN verification') ||
      message.includes('must use the escrow release flow') ||
      message.includes('must use the canonical dispute flow')
    ) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (message.includes('not found')) return NextResponse.json({ error: message }, { status: 404 })
    if (message.includes('concurrently')) return NextResponse.json({ error: message }, { status: 409 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
