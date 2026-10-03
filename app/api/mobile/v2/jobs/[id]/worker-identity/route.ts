import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { resolveJobWorkerIdentity } from '@/lib/identity/job-worker-identity'
import { createWorkItem } from '@/lib/work-queue'
import { recordJobLifecycleEvent } from '@/lib/domain/job-lifecycle-audit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: jobId } = await params
    const job = await prisma.marketplaceJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        customerId: true,
        workerIdentityCheckRequired: true,
      },
    })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const worker = await prisma.$transaction(tx => resolveJobWorkerIdentity(tx, jobId))
    if (!worker) {
      return NextResponse.json({
        required: job.workerIdentityCheckRequired,
        worker: null,
        confirmation: null,
      })
    }

    const isCustomer = job.customerId === user.id
    const isWorker = worker.assignedWorkerUserId === user.id
    if (!isCustomer && !isWorker) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const confirmation = await prisma.jobWorkerIdentityCheck.findUnique({
      where: {
        jobId_providerIdentityId: {
          jobId,
          providerIdentityId: worker.providerIdentityId,
        },
      },
      select: {
        id: true,
        status: true,
        confirmedAt: true,
        mismatchReportedAt: true,
      },
    })

    return NextResponse.json({
      required: job.workerIdentityCheckRequired,
      worker: {
        providerIdentityId: worker.providerIdentityId,
        providerType: worker.providerType,
        userId: worker.assignedWorkerUserId,
        displayName: worker.displayName,
        verifiedPhotoUrl: worker.verifiedPhotoUrl,
        identityVerified: worker.identityVerified,
        companyId: worker.companyId,
        companyName: worker.companyName,
      },
      confirmation: confirmation
        ? {
            id: confirmation.id,
            status: confirmation.status,
            confirmedAt: confirmation.confirmedAt?.toISOString() || null,
            mismatchReportedAt: confirmation.mismatchReportedAt?.toISOString() || null,
          }
        : null,
    })
  } catch (error) {
    console.error('Worker identity GET error:', error)
    return NextResponse.json({ error: 'Failed to load worker identity' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { id: jobId } = await params
    const body = await request.json().catch(() => ({}))
    const decision = typeof body?.decision === 'string' ? body.decision.toUpperCase() : ''
    const reason =
      typeof body?.reason === 'string' ? body.reason.trim().slice(0, 1000) : null

    if (!['MATCH', 'MISMATCH'].includes(decision)) {
      return NextResponse.json({ error: 'decision must be MATCH or MISMATCH' }, { status: 400 })
    }

    const result = await prisma.$transaction(async tx => {
      const job = await tx.marketplaceJob.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          customerId: true,
          status: true,
          workerIdentityCheckRequired: true,
        },
      })
      if (!job) throw new Error('JOB_NOT_FOUND')
      if (job.customerId !== user.id) throw new Error('NOT_CUSTOMER')
      if (!['QUOTE_ACCEPTED', 'IN_PROGRESS'].includes(job.status)) {
        throw new Error('JOB_NOT_ACTIVE')
      }

      const worker = await resolveJobWorkerIdentity(tx, jobId)
      if (!worker) throw new Error('WORKER_NOT_ASSIGNED')

      if (decision === 'MATCH' && !worker.identityVerified) {
        throw new Error('WORKER_IDENTITY_NOT_VERIFIED')
      }

      const now = new Date()
      const check = await tx.jobWorkerIdentityCheck.upsert({
        where: {
          jobId_providerIdentityId: {
            jobId,
            providerIdentityId: worker.providerIdentityId,
          },
        },
        create: {
          jobId,
          customerId: user.id,
          providerIdentityId: worker.providerIdentityId,
          assignedWorkerUserId: worker.assignedWorkerUserId,
          displayNameSnapshot: worker.displayName,
          photoSnapshotUrl: worker.verifiedPhotoUrl,
          status: decision === 'MATCH' ? 'MATCHED' : 'MISMATCH_REPORTED',
          confirmedAt: decision === 'MATCH' ? now : null,
          mismatchReportedAt: decision === 'MISMATCH' ? now : null,
          mismatchReason: decision === 'MISMATCH' ? reason : null,
        },
        update: {
          customerId: user.id,
          assignedWorkerUserId: worker.assignedWorkerUserId,
          displayNameSnapshot: worker.displayName,
          photoSnapshotUrl: worker.verifiedPhotoUrl,
          status: decision === 'MATCH' ? 'MATCHED' : 'MISMATCH_REPORTED',
          confirmedAt: decision === 'MATCH' ? now : null,
          mismatchReportedAt: decision === 'MISMATCH' ? now : null,
          mismatchReason: decision === 'MISMATCH' ? reason : null,
        },
      })

      if (decision === 'MISMATCH') {
        await tx.providerIntegritySignal.create({
          data: {
            providerIdentityId: worker.providerIdentityId,
            userId: worker.assignedWorkerUserId,
            jobId,
            signalType: 'CUSTOMER_WORKER_IDENTITY_MISMATCH',
            severity: 'HIGH',
            source: 'CUSTOMER_APP',
            status: 'OPEN',
            metadata: JSON.stringify({
              companyId: worker.companyId,
              providerType: worker.providerType,
              reason,
            }),
          },
        })

        await tx.marketplaceRiskEvent.create({
          data: {
            jobId,
            actorUserId: user.id,
            eventType: 'WORKER_IDENTITY_MISMATCH',
            severity: 'HIGH',
            metadata: JSON.stringify({
              providerIdentityId: worker.providerIdentityId,
              assignedWorkerUserId: worker.assignedWorkerUserId,
              companyId: worker.companyId,
              reason,
            }),
          },
        })
      }

      await recordJobLifecycleEvent(tx, {
        jobId,
        actorId: user.id,
        actorType: 'CUSTOMER',
        action:
          decision === 'MATCH'
            ? 'WORKER_IDENTITY_CONFIRMED'
            : 'WORKER_IDENTITY_MISMATCH_REPORTED',
        metadata: {
          providerIdentityId: worker.providerIdentityId,
          assignedWorkerUserId: worker.assignedWorkerUserId,
          providerType: worker.providerType,
          companyId: worker.companyId,
          identityVerified: worker.identityVerified,
          reason,
        },
      })

      return { job, worker, check }
    })

    if (decision === 'MISMATCH') {
      await createWorkItem({
        category: 'kyc',
        title: 'Worker identity mismatch reported',
        description: `Customer reported that the person arriving for job ${jobId} does not match the verified worker profile. Work start must remain blocked until reviewed.`,
        targetTable: 'JobWorkerIdentityCheck',
        targetId: result.check.id,
      })
    }

    return NextResponse.json({
      success: true,
      required: result.job.workerIdentityCheckRequired,
      confirmation: {
        id: result.check.id,
        status: result.check.status,
        confirmedAt: result.check.confirmedAt?.toISOString() || null,
        mismatchReportedAt: result.check.mismatchReportedAt?.toISOString() || null,
      },
    })
  } catch (error) {
    console.error('Worker identity confirmation error:', error)
    const message = error instanceof Error ? error.message : ''

    if (message === 'JOB_NOT_FOUND') {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (message === 'NOT_CUSTOMER') {
      return NextResponse.json({ error: 'Only the customer can confirm worker identity' }, { status: 403 })
    }
    if (message === 'WORKER_NOT_ASSIGNED') {
      return NextResponse.json(
        { error: 'No assigned worker is available for identity confirmation', code: 'WORKER_NOT_ASSIGNED' },
        { status: 409 },
      )
    }
    if (message === 'WORKER_IDENTITY_NOT_VERIFIED') {
      return NextResponse.json(
        {
          error: 'This worker does not yet have an approved MaintainEX identity photo.',
          code: 'WORKER_IDENTITY_NOT_VERIFIED',
        },
        { status: 409 },
      )
    }
    if (message === 'JOB_NOT_ACTIVE') {
      return NextResponse.json({ error: 'Worker identity can only be confirmed for an active booking' }, { status: 409 })
    }

    return NextResponse.json({ error: 'Failed to confirm worker identity' }, { status: 500 })
  }
}
