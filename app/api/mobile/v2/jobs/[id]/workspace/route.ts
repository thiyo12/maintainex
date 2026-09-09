import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
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
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const actorType = await resolveJobActor(job.id, job.customerId, user.id)
    if (!actorType) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId: params.id } })
    return NextResponse.json({ workspace: workspace || null })
  } catch (error) {
    console.error('Get workspace error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const progressStatus = body.progressStatus as WorkspaceStatus
    const validStatuses: WorkspaceStatus[] = ['ACCEPTED', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'COMPLETION_REQUESTED', 'COMPLETED', 'DISPUTED']
    if (!progressStatus || !validStatuses.includes(progressStatus)) {
      return NextResponse.json({ error: 'Invalid progressStatus' }, { status: 400 })
    }

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const actorType = await resolveJobActor(job.id, job.customerId, user.id)
    if (!actorType) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const updated = await transitionJobWorkspace(
      { jobId: job.id, actorId: user.id, actorType },
      progressStatus
    )

    return NextResponse.json({ workspace: updated })
  } catch (error: any) {
    console.error('Update workspace error:', error)
    const message = error?.message || 'Server error'
    if (message.includes('cannot transition') || message.includes('Cannot transition') || message.includes('Actor type')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (message.includes('not found')) return NextResponse.json({ error: message }, { status: 404 })
    if (message.includes('concurrently')) return NextResponse.json({ error: message }, { status: 409 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
