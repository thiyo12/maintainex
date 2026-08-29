import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(_request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const isParticipant = job.customerId === user.id ||
      !!(await prisma.jobQuote.findFirst({ where: { jobId: params.id, providerId: user.id } }))
    if (!isParticipant) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

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
    const { progressStatus } = body

    const validStatuses = ['ACCEPTED', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'COMPLETION_REQUESTED', 'COMPLETED', 'DISPUTED']
    if (!progressStatus || !validStatuses.includes(progressStatus)) {
      return NextResponse.json({ error: 'Invalid progressStatus' }, { status: 400 })
    }

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const isCustomer = job.customerId === user.id
    const isProvider = !isCustomer &&
      !!(await prisma.jobQuote.findFirst({ where: { jobId: params.id, providerId: user.id } }))
    if (!isCustomer && !isProvider) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId: params.id } })
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    // State machine: only allow valid transitions
    const validTransitions: Record<string, string[]> = {
      ACCEPTED: ['IN_PROGRESS', 'DISPUTED'],
      IN_PROGRESS: ['WAITING_CUSTOMER', 'COMPLETION_REQUESTED', 'DISPUTED'],
      WAITING_CUSTOMER: ['IN_PROGRESS', 'COMPLETION_REQUESTED', 'DISPUTED'],
      COMPLETION_REQUESTED: ['COMPLETED', 'DISPUTED'],
      COMPLETED: [],
      DISPUTED: [],
    }
    const allowed = validTransitions[workspace.progressStatus]
    if (!allowed || !allowed.includes(progressStatus)) {
      return NextResponse.json({
        error: `Cannot transition from ${workspace.progressStatus} to ${progressStatus}`,
      }, { status: 400 })
    }

    // Role-based transition restrictions
    const providerOnly: string[] = ['COMPLETION_REQUESTED']
    const customerOnly: string[] = ['IN_PROGRESS']
    if (providerOnly.includes(progressStatus) && !isProvider) {
      return NextResponse.json({ error: 'Only the provider can perform this action' }, { status: 403 })
    }
    if (customerOnly.includes(progressStatus) && !isCustomer) {
      return NextResponse.json({ error: 'Only the customer can perform this action' }, { status: 403 })
    }

    const updated = await prisma.jobWorkspace.update({
      where: { jobId: params.id },
      data: { progressStatus },
    })

    if (progressStatus === 'COMPLETED') {
      await prisma.marketplaceJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED' },
      })
    }
    if (progressStatus === 'DISPUTED') {
      await prisma.marketplaceJob.update({
        where: { id: job.id },
        data: { status: 'CANCELLED' },
      })
    }

    return NextResponse.json({ workspace: updated })
  } catch (error) {
    console.error('Update workspace error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
