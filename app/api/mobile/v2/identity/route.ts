import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { createWorkItem } from '@/lib/work-queue'
import { transitionUserKyc } from '@/lib/phase6/kyc-writer'
import { ensureProviderIdentity } from '@/lib/finance/commissions/provider-balance-service'
import { ensureCompanyWorkerIdentity } from '@/lib/identity/job-worker-identity'
import {
  claimTypeForDocument,
  recordStrongIdentityClaim,
} from '@/lib/identity/identity-claims'
import { resolveLocalKycFileReference } from '@/lib/security/kyc-storage'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const docs = await prisma.identityDocument.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      identityStatus: user.identityStatus || 'NOT_SUBMITTED',
      documents: docs,
    })
  } catch (error) {
    console.error('Get identity error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { docType, side, imageUrl, fullName } = body
    const documentNumber =
      typeof body?.documentNumber === 'string'
        ? body.documentNumber.trim().slice(0, 120)
        : ''
    const companyId =
      typeof body?.companyId === 'string' && body.companyId.trim()
        ? body.companyId.trim()
        : null

    if (!docType || !side || !imageUrl) {
      return NextResponse.json({ error: 'Missing required fields: docType, side, imageUrl' }, { status: 400 })
    }

    const privateFile = resolveLocalKycFileReference(
      String(imageUrl),
      user.id,
      request.nextUrl.origin,
    )
    if (!privateFile) {
      return NextResponse.json(
        {
          error: 'Identity evidence must be uploaded through the protected MaintainEX file channel.',
          code: 'INVALID_KYC_FILE_REFERENCE',
        },
        { status: 400 },
      )
    }

    if (user.role === 'TASKER' && !fullName?.trim()) {
      return NextResponse.json({ error: 'Full name exactly as on the ID is required' }, { status: 400 })
    }

    const validDocTypes = ['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE']
    if (!validDocTypes.includes(docType)) {
      return NextResponse.json({ error: 'Invalid docType. Must be PASSPORT, NATIONAL_ID, or DRIVERS_LICENSE' }, { status: 400 })
    }

    const validSides = ['FRONT', 'BACK']
    if (!validSides.includes(side)) {
      return NextResponse.json({ error: 'Invalid side. Must be FRONT or BACK' }, { status: 400 })
    }

    const result = await prisma.$transaction(async tx => {
      let providerIdentity: { id: string } | null = null

      if (user.role === 'TASKER') {
        const tasker = await tx.taskerProfile.findUnique({
          where: { userId: user.id },
          select: { id: true, countryCode: true },
        })
        if (!tasker) throw new Error('TASKER_PROFILE_NOT_FOUND')

        providerIdentity = await ensureProviderIdentity(tx, {
          providerId: user.id,
          providerType: 'INDIVIDUAL',
          countryCode: tasker.countryCode || user.countryCode || 'LK',
        })
      } else if (user.role === 'COMPANY') {
        const company = await tx.companyProfile.findUnique({
          where: { userId: user.id },
          select: { id: true, countryCode: true },
        })
        if (!company) throw new Error('COMPANY_PROFILE_NOT_FOUND')

        providerIdentity = await ensureProviderIdentity(tx, {
          providerId: company.id,
          providerType: 'COMPANY',
          countryCode: company.countryCode || user.countryCode || 'LK',
        })
      } else if (companyId) {
        const worker = await ensureCompanyWorkerIdentity(tx, {
          companyId,
          userId: user.id,
          countryCode: user.countryCode || 'LK',
        })
        if (!worker) throw new Error('COMPANY_WORKER_IDENTITY_NOT_FOUND')
        providerIdentity = worker.identity
      }

      if (providerIdentity && !documentNumber) {
        throw new Error('DOCUMENT_NUMBER_REQUIRED')
      }

      const doc = await tx.identityDocument.create({
        data: {
          userId: user.id,
          docType,
          side,
          imageUrl,
          fullName: fullName?.trim() || null,
          status: 'PENDING',
        },
      })

      let claimAssessment: {
        duplicateMatch: boolean
        highRisk: boolean
      } | null = null

      if (providerIdentity && documentNumber) {
        const claimType = claimTypeForDocument(docType)
        if (!claimType) throw new Error('UNSUPPORTED_IDENTITY_CLAIM_TYPE')

        claimAssessment = await recordStrongIdentityClaim(tx, {
          providerIdentityId: providerIdentity.id,
          userId: user.id,
          claimType,
          rawValue: documentNumber,
          source: 'KYC_SUBMISSION',
        })
      }

      return { doc, claimAssessment }
    })

    const currentStatus = (user.identityStatus || 'NOT_SUBMITTED').toUpperCase()
    if (currentStatus !== 'PENDING') {
      const transition = await transitionUserKyc(prisma, {
        userId: user.id,
        action: 'SUBMIT',
        documentId: result.doc.id,
      })

      if (!transition.success) {
        return NextResponse.json({ error: transition.error }, { status: 400 })
      }
    }

    await createWorkItem({
      category: 'kyc',
      title: result.claimAssessment?.duplicateMatch
        ? `KYC identity integrity review — ${docType} (${side})`
        : `KYC document submitted — ${docType} (${side})`,
      description: result.claimAssessment?.duplicateMatch
        ? `User ${user.name || user.email} submitted identity evidence that matches another durable provider identity. Review identity integrity signals before approval.`
        : `User ${user.name || user.email} submitted a ${docType} for identity verification.`,
      targetTable: 'IdentityDocument',
      targetId: result.doc.id,
      priority: result.claimAssessment?.highRisk ? 'high' : undefined,
    })

    return NextResponse.json({
      document: result.doc,
      integrityReviewRequired: result.claimAssessment?.duplicateMatch || false,
      highRiskIdentityMatch: result.claimAssessment?.highRisk || false,
    }, { status: 201 })
  } catch (error) {
    console.error('Upload identity error:', error)
    const message = error instanceof Error ? error.message : ''

    if (message === 'DOCUMENT_NUMBER_REQUIRED') {
      return NextResponse.json(
        {
          error: 'Document number is required for provider identity verification.',
          code: 'DOCUMENT_NUMBER_REQUIRED',
        },
        { status: 400 },
      )
    }
    if (
      message === 'TASKER_PROFILE_NOT_FOUND' ||
      message === 'COMPANY_PROFILE_NOT_FOUND' ||
      message === 'COMPANY_WORKER_IDENTITY_NOT_FOUND'
    ) {
      return NextResponse.json({ error: 'Provider identity profile not found' }, { status: 404 })
    }
    if (
      message === 'STRONG_IDENTITY_CLAIM_TOO_SHORT' ||
      message === 'UNSUPPORTED_IDENTITY_CLAIM_TYPE'
    ) {
      return NextResponse.json(
        { error: 'Enter a valid document number.' },
        { status: 400 },
      )
    }
    if (message.includes('IDENTITY_CLAIM_PEPPER')) {
      return NextResponse.json(
        { error: 'Identity verification is temporarily unavailable.' },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
