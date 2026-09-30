import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { id: jobId } = await params
    const body = await request.json()
    const { inspectionId, evidenceType, url, description, mimeType } = body

    if (!evidenceType) {
      return NextResponse.json({ error: 'evidenceType required' }, { status: 400 })
    }

    // Verify job exists
    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    // Determine uploader type
    const isCustomer = job.customerId === user.id
    const uploaderType = isCustomer ? 'CUSTOMER' : 'PROVIDER'

    // When no inspectionId, verify the user is a party to the job
    if (!inspectionId && !isCustomer) {
      const hasAcceptedQuote = await prisma.jobQuote.findFirst({
        where: { jobId, providerId: user.id, status: 'ACCEPTED' },
      })
      if (!hasAcceptedQuote) {
        return NextResponse.json({ error: 'Not authorized for this job' }, { status: 403 })
      }
    }

    // If uploading to an inspection, verify the user is the assigned provider or customer
    if (inspectionId) {
      const inspection = await prisma.jobInspection.findUnique({ where: { id: inspectionId } })
      if (!inspection) return NextResponse.json({ error: 'Inspection not found' }, { status: 404 })
      if (inspection.jobId !== jobId) {
        return NextResponse.json({ error: 'Inspection does not belong to this job' }, { status: 400 })
      }

      // Verify provider ownership
      if (uploaderType === 'PROVIDER') {
        if (inspection.taskerId && inspection.taskerId !== user.id) {
          return NextResponse.json({ error: 'Not the assigned provider' }, { status: 403 })
        }
        if (inspection.companyId && inspection.companyId !== user.id) {
          return NextResponse.json({ error: 'Not the assigned company' }, { status: 403 })
        }
      }
    }

    const evidence = await prisma.jobEvidence.create({
      data: {
        jobId,
        inspectionId: inspectionId ?? null,
        uploaderId: user.id,
        uploaderType,
        evidenceType,
        url: url ?? null,
        description: description ?? null,
        mimeType: mimeType ?? null,
      },
    })

    return NextResponse.json({ success: true, evidenceId: evidence.id }, { status: 201 })
  } catch (error) {
    console.error('Upload evidence error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
