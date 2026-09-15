import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

interface CustomerStatusProjection {
  stage: string
  label: string
  description: string
  providerName: string | null
  providerVerified: boolean
  inspectionRequired: boolean
  inspectionStatus: string | null
  inspectionVerified: boolean
  quoteStatus: string | null
  quoteAmount: number | null
  changeOrderPending: boolean
  completionRequested: boolean
  pinActive: boolean
  canConfirmArrival: boolean
  canApproveQuote: boolean
  canApproveChangeOrder: boolean
  canApproveCompletion: boolean
  authorizedAmount: number | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: jobId } = await params

  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (job.customerId !== auth.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId } })
  const acceptedQuote = job.approvedQuoteId
    ? await prisma.jobQuote.findUnique({ where: { id: job.approvedQuoteId } })
    : await prisma.jobQuote.findFirst({ where: { jobId, status: 'ACCEPTED' } })

  const inspection = await prisma.jobInspection.findFirst({
    where: { jobId },
    orderBy: { createdAt: 'desc' },
  })

  const pendingChangeOrder = await prisma.jobChangeOrder.findFirst({
    where: { jobId, status: { in: ['SUBMITTED', 'DRAFT'] } },
    orderBy: { createdAt: 'desc' },
  })

  const activePin = await prisma.jobVerificationPin.findFirst({
    where: { jobId, status: 'ACTIVE' },
  })

  let providerName: string | null = null
  if (acceptedQuote) {
    if (acceptedQuote.providerType === 'INDIVIDUAL') {
      const profile = await prisma.taskerProfile.findUnique({
        where: { userId: acceptedQuote.providerId },
        select: { user: { select: { name: true } } },
      })
      providerName = profile?.user?.name ?? null
    } else {
      const company = await prisma.companyProfile.findUnique({
        where: { id: acceptedQuote.providerId },
        select: { companyName: true },
      })
      providerName = company?.companyName ?? null
    }
  }

  const { stage, label, description } = resolveCustomerStage(job.status, workspace?.progressStatus ?? null, inspection, acceptedQuote, pendingChangeOrder)

  const projection: CustomerStatusProjection = {
    stage,
    label,
    description,
    providerName,
    providerVerified: inspection?.verifiedByCustomer ?? false,
    inspectionRequired: job.requiresInspection,
    inspectionStatus: inspection?.status ?? null,
    inspectionVerified: inspection?.verifiedByCustomer ?? false,
    quoteStatus: acceptedQuote?.status ?? null,
    quoteAmount: acceptedQuote ? Number(acceptedQuote.price) : null,
    changeOrderPending: !!pendingChangeOrder,
    completionRequested: workspace?.progressStatus === 'COMPLETION_REQUESTED',
    pinActive: !!activePin,
    canConfirmArrival: job.status === 'QUOTE_ACCEPTED' || job.status === 'IN_PROGRESS',
    canApproveQuote: !acceptedQuote || acceptedQuote.status === 'PENDING',
    canApproveChangeOrder: !!pendingChangeOrder && pendingChangeOrder.status === 'SUBMITTED',
    canApproveCompletion: workspace?.progressStatus === 'COMPLETION_REQUESTED',
    authorizedAmount: job.finalAuthorizedAmountCents ? Number(job.finalAuthorizedAmountCents) : null,
  }

  return NextResponse.json({ status: projection })
}

function resolveCustomerStage(
  jobStatus: string,
  workspaceStatus: string | null,
  inspection: any,
  acceptedQuote: any,
  pendingChangeOrder: any
): { stage: string; label: string; description: string } {
  if (jobStatus === 'CANCELLED') return { stage: 'CANCELLED', label: 'Cancelled', description: 'This job has been cancelled' }
  if (jobStatus === 'COMPLETED') return { stage: 'COMPLETED', label: 'Completed', description: 'This job is complete' }

  if (jobStatus === 'OPEN') {
    if (!acceptedQuote) return { stage: 'FINDING_PROVIDER', label: 'Finding provider', description: 'Waiting for providers to submit quotes' }
    return { stage: 'QUOTE_RECEIVED', label: 'Quote received', description: 'A provider has submitted a quote' }
  }

  if (jobStatus === 'QUOTE_ACCEPTED') {
    if (inspection && !inspection.verifiedByCustomer && inspection.status === 'ARRIVED') {
      return { stage: 'ARRIVAL_CONFIRMATION_REQUIRED', label: 'Confirm provider arrival', description: 'The provider has arrived and needs your confirmation' }
    }
    if (inspection && inspection.status !== 'COMPLETED') {
      return { stage: 'INSPECTION_IN_PROGRESS', label: 'Inspection in progress', description: 'The provider is conducting an inspection' }
    }
    if (inspection && inspection.status === 'COMPLETED' && !inspection.verifiedByCustomer) {
      return { stage: 'INSPECTION_COMPLETED', label: 'Inspection completed', description: 'Inspection is complete. Review the results.' }
    }
    return { stage: 'SCHEDULED', label: 'Scheduled', description: 'Provider has been selected and work is being scheduled' }
  }

  if (jobStatus === 'IN_PROGRESS') {
    if (workspaceStatus === 'ACCEPTED') return { stage: 'PROVIDER_ARRIVED', label: 'Provider arrived', description: 'Provider is on site' }
    if (workspaceStatus === 'IN_PROGRESS') return { stage: 'WORK_IN_PROGRESS', label: 'Work in progress', description: 'The provider is working on your job' }
    if (workspaceStatus === 'WAITING_CUSTOMER') return { stage: 'WAITING_CUSTOMER', label: 'Waiting for you', description: 'The provider needs your input' }
    if (workspaceStatus === 'COMPLETION_REQUESTED') return { stage: 'COMPLETION_PENDING', label: 'Completion pending', description: 'The provider has requested completion. Please review.' }
    if (workspaceStatus === 'COMPLETED') return { stage: 'COMPLETED', label: 'Completed', description: 'This job is complete' }
    return { stage: 'WORK_IN_PROGRESS', label: 'Work in progress', description: 'The provider is working on your job' }
  }

  return { stage: 'UNKNOWN', label: 'Unknown', description: '' }
}
