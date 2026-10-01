import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { checkWorkerEligibility } from '@/lib/phase6/provider-eligibility'
import { createAssignment, reassignWorker } from '@/lib/domain/company-job-assignment'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { companyId, jobId, workerUserId, reason } = body

    if (!companyId || !jobId || !workerUserId) {
      return NextResponse.json({ error: 'companyId, jobId, and workerUserId are required' }, { status: 400 })
    }

    const { context, error } = await resolveCompanyContext(user.id, companyId, 'workers:assign')
    if (error) return error

    const eligibility = await checkWorkerEligibility(companyId, workerUserId, jobId)
    if (!eligibility.eligible) {
      return NextResponse.json({ error: 'Worker not eligible', reasons: eligibility.reasons }, { status: 400 })
    }

    const existingAssignment = await prisma.companyJobAssignment.findFirst({
      where: {
        jobId,
        status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
      },
    })

    let result
    if (existingAssignment) {
      if (reason === undefined) {
        return NextResponse.json({
          error: 'Job already has an active assignment. Provide a reason to reassign.',
          activeAssignmentId: existingAssignment.id,
          activeWorkerUserId: existingAssignment.workerUserId,
        }, { status: 409 })
      }
      result = await reassignWorker(
        companyId, jobId, workerUserId, user.id, context!.role, reason
      )
    } else {
      result = await createAssignment({
        companyId, jobId, workerUserId,
        assignedByUserId: user.id,
        actorRole: context!.role,
      })
    }

    if (!result.success) {
      const message = result.error || 'Worker assignment failed'
      const isConflict =
        message.includes('concurrently') ||
        message.includes('scheduling conflict') ||
        message.includes('changed before reassignment') ||
        message.includes('already has an active assignment') ||
        message.includes('already assigned') ||
        message.includes('already the active assignee') ||
        message.includes('No active worker assignment exists') ||
        message.includes('Cannot reassign')

      return NextResponse.json(
        { error: message, reasons: result.reasons },
        { status: isConflict ? 409 : 400 }
      )
    }

    return NextResponse.json({ success: true, assignmentId: result.assignmentId, assignedTo: workerUserId })
  } catch (err) {
    console.error('Worker assignment error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
