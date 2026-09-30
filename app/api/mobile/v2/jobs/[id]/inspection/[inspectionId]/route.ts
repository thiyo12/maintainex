import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { transitionInspection, completeInspection, scheduleInspection, verifyInspectionArrival } from '@/lib/domain/inspection'
import { notifyInspectionArrived, notifyInspectionCompleted } from '@/lib/notifications'
import { resolveCompanyContext } from '@/lib/phase6/company-context'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; inspectionId: string }> }
) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { id: jobId, inspectionId } = await params
    const boundInspection = await prisma.jobInspection.findUnique({
      where: { id: inspectionId },
      select: { jobId: true },
    })
    if (!boundInspection || boundInspection.jobId !== jobId) {
      return NextResponse.json({ error: 'Inspection not found for this job' }, { status: 404 })
    }
    const body = await request.json()
    const { action } = body

    if (action === 'schedule') {
      if (!body.scheduledAt) {
        return NextResponse.json({ error: 'scheduledAt required' }, { status: 400 })
      }
      const result = await scheduleInspection(prisma, {
        inspectionId,
        userId: user.id,
        scheduledAt: new Date(body.scheduledAt),
        windowStart: body.windowStart,
        windowEnd: body.windowEnd,
      })
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    if (action === 'arrive') {
      const result = await transitionInspection(prisma, {
        inspectionId,
        userId: user.id,
        toStatus: 'ARRIVED',
      })
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })

      const inspection = await prisma.jobInspection.findUnique({
        where: { id: inspectionId },
        select: {
          taskerId: true,
          companyId: true,
          job: { select: { id: true, customerId: true, title: true } },
        },
      })
      if (inspection?.job) {
        const { job } = inspection
        let providerName = 'Provider'
        if (inspection.taskerId) {
          const tasker = await prisma.user.findUnique({ where: { id: inspection.taskerId }, select: { name: true } })
          providerName = tasker?.name || providerName
        } else if (inspection.companyId) {
          const company = await prisma.companyProfile.findUnique({
            where: { id: inspection.companyId },
            select: { companyName: true },
          })
          providerName = company?.companyName || providerName
        }
        await notifyInspectionArrived(job.id, job.customerId, providerName, job.title)
      }

      return NextResponse.json({ success: true })
    }

    if (action === 'start') {
      const result = await transitionInspection(prisma, {
        inspectionId,
        userId: user.id,
        toStatus: 'IN_PROGRESS',
      })
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    if (action === 'complete') {
      if (!body.diagnosisSummary || !body.scopeSummary) {
        return NextResponse.json({ error: 'diagnosisSummary and scopeSummary required' }, { status: 400 })
      }
      const result = await completeInspection(prisma, {
        inspectionId,
        providerId: user.id,
        diagnosisSummary: body.diagnosisSummary,
        scopeSummary: body.scopeSummary,
        materialsSummary: body.materialsSummary,
        estimatedDuration: body.estimatedDuration,
        risksAndLimitations: body.risksAndLimitations,
      })
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })

      const inspection = await prisma.jobInspection.findUnique({
        where: { id: inspectionId },
        select: {
          taskerId: true,
          companyId: true,
          job: { select: { id: true, customerId: true, title: true } },
        },
      })
      if (inspection?.job) {
        const { job } = inspection
        let providerName = 'Provider'
        if (inspection.taskerId) {
          const tasker = await prisma.user.findUnique({ where: { id: inspection.taskerId }, select: { name: true } })
          providerName = tasker?.name || providerName
        } else if (inspection.companyId) {
          const company = await prisma.companyProfile.findUnique({
            where: { id: inspection.companyId },
            select: { companyName: true },
          })
          providerName = company?.companyName || providerName
        }
        await notifyInspectionCompleted(job.id, job.customerId, providerName, job.title)
      }

      return NextResponse.json({ success: true })
    }

    if (action === 'cancel') {
      const result = await transitionInspection(prisma, {
        inspectionId,
        userId: user.id,
        toStatus: 'CANCELLED',
        notes: body.reason,
      })
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    if (action === 'no_show') {
      const result = await transitionInspection(prisma, {
        inspectionId,
        userId: user.id,
        toStatus: 'NO_SHOW',
      })
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Inspection transition error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; inspectionId: string }> }
) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: jobId, inspectionId } = await params

    const inspection = await prisma.jobInspection.findUnique({
      where: { id: inspectionId },
      include: {
        evidence: true,
        job: { select: { customerId: true } },
      },
    })

    if (!inspection || inspection.jobId !== jobId) {
      return NextResponse.json({ error: 'Inspection not found for this job' }, { status: 404 })
    }

    let authorized = inspection.job.customerId === user.id || inspection.taskerId === user.id
    if (!authorized && inspection.companyId) {
      const { context } = await resolveCompanyContext(user.id, inspection.companyId, 'jobs:read')
      authorized = Boolean(context)
    }
    if (!authorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ inspection })
  } catch (error) {
    console.error('Get inspection error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; inspectionId: string }> }
) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { id: jobId, inspectionId } = await params
    const inspection = await prisma.jobInspection.findUnique({
      where: { id: inspectionId },
      select: { jobId: true },
    })
    if (!inspection || inspection.jobId !== jobId) {
      return NextResponse.json({ error: 'Inspection not found for this job' }, { status: 404 })
    }
    const body = await request.json()

    if (body.action === 'verify') {
      const result = await verifyInspectionArrival(prisma, inspectionId, user.id)
      if (!result.success) return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Inspection verify error:', error)
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') return NextResponse.json({ error: 'Inspection not found' }, { status: 404 })
      if (error.message === 'NOT_CUSTOMER') return NextResponse.json({ error: 'Only the customer can verify arrival' }, { status: 403 })
      if (error.message === 'INVALID_STATUS') return NextResponse.json({ error: 'Inspection must be in ARRIVED status' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
